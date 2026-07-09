import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  UnsupportedMediaTypeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ResumeBrainService, UploadedResumeFile } from './resume-brain.service';
import { DocumentParserService } from './document-parser.service';
import { AIExtractorService } from './ai-extractor.service';
import { ResumeValidatorService } from './resume-validator.service';
import { EMPTY_EXTRACTED_RESUME } from './dto/extracted-resume.dto';

const makeFile = (over: Partial<UploadedResumeFile> = {}): UploadedResumeFile => ({
  originalname: 'resume.pdf',
  mimetype: 'application/pdf',
  size: 1024,
  buffer: Buffer.from('dummy'),
  ...over,
});

describe('ResumeBrainService', () => {
  let service: ResumeBrainService;
  let parser: { extractText: jest.Mock };
  let aiExtractor: { extract: jest.Mock; providerName: string };
  let validator: { validate: jest.Mock };

  beforeEach(async () => {
    parser = { extractText: jest.fn() };
    aiExtractor = { extract: jest.fn(), providerName: 'fake' };
    // Default: validator passes its input straight through.
    validator = { validate: jest.fn((x) => x) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResumeBrainService,
        { provide: DocumentParserService, useValue: parser },
        { provide: AIExtractorService, useValue: aiExtractor },
        { provide: ResumeValidatorService, useValue: validator },
      ],
    }).compile();

    service = module.get<ResumeBrainService>(ResumeBrainService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('health', () => {
    it('returns an ok status for the Resume Brain module', () => {
      expect(service.health()).toEqual({
        status: 'ok',
        module: 'Resume Brain',
      });
    });
  });

  describe('describeUpload', () => {
    it('returns filename, mimetype and size for a valid PDF', () => {
      const file = makeFile();
      expect(service.describeUpload(file)).toEqual({
        filename: 'resume.pdf',
        mimetype: 'application/pdf',
        size: 1024,
      });
    });

    it('accepts a .docx file', () => {
      const file = makeFile({
        originalname: 'cv.docx',
        mimetype:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      expect(service.describeUpload(file).filename).toBe('cv.docx');
    });

    it('accepts a legacy .doc file', () => {
      const file = makeFile({
        originalname: 'cv.doc',
        mimetype: 'application/msword',
      });
      expect(service.describeUpload(file).filename).toBe('cv.doc');
    });

    it('accepts a file with a valid extension even if the MIME type is generic', () => {
      const file = makeFile({
        originalname: 'resume.pdf',
        mimetype: 'application/octet-stream',
      });
      expect(service.describeUpload(file).filename).toBe('resume.pdf');
    });

    it('throws 400 when no file is provided', () => {
      expect(() => service.describeUpload(undefined)).toThrow(BadRequestException);
    });

    it('throws 415 for an unsupported type (image/png)', () => {
      const file = makeFile({ originalname: 'image.png', mimetype: 'image/png' });
      expect(() => service.describeUpload(file)).toThrow(
        UnsupportedMediaTypeException,
      );
    });
  });

  describe('parseResume', () => {
    it('returns upload metadata plus the extracted text', async () => {
      parser.extractText.mockResolvedValue('John Doe\nSoftware Engineer');
      const file = makeFile();

      await expect(service.parseResume(file)).resolves.toEqual({
        filename: 'resume.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        text: 'John Doe\nSoftware Engineer',
      });
      expect(parser.extractText).toHaveBeenCalledWith(file);
    });

    it('rejects with 415 before parsing when the type is unsupported', async () => {
      const file = makeFile({ originalname: 'image.png', mimetype: 'image/png' });

      await expect(service.parseResume(file)).rejects.toThrow(
        UnsupportedMediaTypeException,
      );
      expect(parser.extractText).not.toHaveBeenCalled();
    });

    it('rejects with 400 when no file is provided', async () => {
      await expect(service.parseResume(undefined)).rejects.toThrow(
        BadRequestException,
      );
      expect(parser.extractText).not.toHaveBeenCalled();
    });

    it('propagates a 422 raised by the parser', async () => {
      parser.extractText.mockRejectedValue(
        new UnprocessableEntityException('No readable text found in the document.'),
      );

      await expect(service.parseResume(makeFile())).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });

  describe('extractProfile', () => {
    it('parses the file, runs AI extraction and returns metadata + profile', async () => {
      parser.extractText.mockResolvedValue('Jane Doe\nEngineer');
      const profile = { ...EMPTY_EXTRACTED_RESUME, firstName: 'Jane' };
      aiExtractor.extract.mockResolvedValue(profile);

      const file = makeFile();
      await expect(service.extractProfile(file)).resolves.toEqual({
        filename: 'resume.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        provider: 'fake',
        profile,
      });
      expect(parser.extractText).toHaveBeenCalledWith(file);
      expect(aiExtractor.extract).toHaveBeenCalledWith('Jane Doe\nEngineer');
      expect(validator.validate).toHaveBeenCalledWith(profile);
    });

    it('propagates a 400 raised by the validator (untrusted AI output)', async () => {
      parser.extractText.mockResolvedValue('some text');
      aiExtractor.extract.mockResolvedValue(EMPTY_EXTRACTED_RESUME);
      validator.validate.mockImplementation(() => {
        throw new BadRequestException('Could not extract a usable profile.');
      });

      await expect(service.extractProfile(makeFile())).rejects.toThrow(
        BadRequestException,
      );
    });

    it('does not call the AI when the type is unsupported (415)', async () => {
      const file = makeFile({ originalname: 'image.png', mimetype: 'image/png' });

      await expect(service.extractProfile(file)).rejects.toThrow(
        UnsupportedMediaTypeException,
      );
      expect(aiExtractor.extract).not.toHaveBeenCalled();
    });
  });
});
