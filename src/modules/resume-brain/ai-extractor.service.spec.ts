import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus, UnprocessableEntityException } from '@nestjs/common';
import { AIExtractorService } from './ai-extractor.service';
import {
  AI_CHAT_PROVIDER,
  AiChatProvider,
  AiProviderError,
} from './ai/ai-chat-provider.interface';

/** A programmable fake provider so no real network call is made. */
class FakeProvider implements AiChatProvider {
  readonly name = 'fake';
  reply: string | (() => never) = '{}';
  async complete(): Promise<string> {
    if (typeof this.reply === 'function') return this.reply();
    return this.reply;
  }
}

describe('AIExtractorService', () => {
  let service: AIExtractorService;
  let provider: FakeProvider;

  beforeEach(async () => {
    provider = new FakeProvider();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIExtractorService,
        { provide: AI_CHAT_PROVIDER, useValue: provider },
      ],
    }).compile();
    service = module.get(AIExtractorService);
  });

  it('turns a dummy resume into a complete, well-typed profile', async () => {
    provider.reply = JSON.stringify({
      firstName: 'Abebe',
      lastName: 'Bikila',
      email: 'abebe@example.com',
      phone: '+251900000000',
      summary: 'Marathon champion and software engineer.',
      headline: 'Senior Engineer',
      location: 'Addis Ababa, Ethiopia',
      skills: ['Node.js', 'React', ''],
      languages: ['Amharic', 'English'],
      certifications: ['AWS SAA'],
      education: [{ school: 'AAU', qualification: 'BSc CS', year: '2016' }],
      experience: [
        {
          role: 'Engineer',
          company: 'Beleqet',
          start: '2020',
          end: 'Present',
          description: 'Built things.',
        },
      ],
    });

    const result = await service.extract('some resume text');

    expect(result.firstName).toBe('Abebe');
    expect(result.summary).toContain('Marathon');
    // Empty skill entries are filtered out during normalisation.
    expect(result.skills).toEqual(['Node.js', 'React']);
    expect(result.education[0]).toEqual({
      school: 'AAU',
      qualification: 'BSc CS',
      year: '2016',
    });
    expect(result.experience[0].company).toBe('Beleqet');
  });

  it('always returns the full schema even when the AI omits fields', async () => {
    provider.reply = JSON.stringify({ firstName: 'Solo' });

    const result = await service.extract('text');

    expect(result).toEqual({
      firstName: 'Solo',
      lastName: '',
      email: '',
      phone: '',
      summary: '',
      headline: '',
      location: '',
      skills: [],
      languages: [],
      certifications: [],
      education: [],
      experience: [],
    });
  });

  it('strips markdown code fences the model may add', async () => {
    provider.reply = '```json\n{"firstName":"Fenced"}\n```';
    const result = await service.extract('text');
    expect(result.firstName).toBe('Fenced');
  });

  it('recovers a JSON object embedded in surrounding prose', async () => {
    provider.reply = 'Sure! Here you go: {"firstName":"Buried"} — hope it helps.';
    const result = await service.extract('text');
    expect(result.firstName).toBe('Buried');
  });

  it('maps alternate education/experience keys onto the contract shape', async () => {
    provider.reply = JSON.stringify({
      education: [{ institution: 'MIT', degree: 'PhD', graduationYear: '2010' }],
      experience: [{ title: 'Lead', employer: 'ACME', startDate: '2011' }],
    });
    const result = await service.extract('text');
    expect(result.education[0]).toEqual({
      school: 'MIT',
      qualification: 'PhD',
      year: '2010',
    });
    expect(result.experience[0].role).toBe('Lead');
    expect(result.experience[0].company).toBe('ACME');
  });

  it('rejects empty resume text with 422', async () => {
    await expect(service.extract('   ')).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('rejects unparseable AI output with 422', async () => {
    provider.reply = 'this is not json at all';
    await expect(service.extract('text')).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('surfaces provider rate-limits as HTTP 429', async () => {
    provider.reply = () => {
      throw new AiProviderError(429, 'rate limited');
    };
    await expect(service.extract('text')).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
  });

  it('surfaces provider outages as HTTP 503', async () => {
    provider.reply = () => {
      throw new AiProviderError(500, 'boom');
    };
    await expect(service.extract('text')).rejects.toMatchObject({
      status: HttpStatus.SERVICE_UNAVAILABLE,
    });
  });
});
