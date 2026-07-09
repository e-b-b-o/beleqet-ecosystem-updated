import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import {
  AiChatMessage,
  AiChatProvider,
  AiCompletionOptions,
  AiProviderError,
} from './ai-chat-provider.interface';

/**
 * GroqProvider — {@link AiChatProvider} backed by Groq.
 *
 * Groq exposes an OpenAI-compatible REST API, so we reuse the `openai` SDK
 * that already ships with this repo (see screening.processor.ts) rather than
 * pulling in a new dependency — we just repoint its `baseURL`. It also reuses
 * the exact same `GROQ_API_KEY` / `GROQ_MODEL` env vars the Next.js frontend
 * already uses (beleqet-jobs-nextjs/lib/groq.ts), so a single config drives
 * both ends.
 *
 * Default model: `llama-3.1-8b-instant` (matches the frontend default).
 */
@Injectable()
export class GroqProvider implements AiChatProvider {
  readonly name = 'groq';

  private readonly logger = new Logger(GroqProvider.name);
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(private readonly config: ConfigService) {
    this.model = this.config.get<string>('GROQ_MODEL', 'llama-3.1-8b-instant');
    this.client = new OpenAI({
      apiKey: this.config.get<string>('GROQ_API_KEY') ?? '',
      baseURL: this.config.get<string>(
        'GROQ_BASE_URL',
        'https://api.groq.com/openai/v1',
      ),
    });
  }

  async complete(
    messages: AiChatMessage[],
    options: AiCompletionOptions = {},
  ): Promise<string> {
    if (!this.config.get<string>('GROQ_API_KEY')) {
      // Fail fast with a 503-mapped error rather than a confusing 401 from Groq.
      throw new AiProviderError(503, 'GROQ_API_KEY is not configured');
    }

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        messages,
        temperature: options.temperature ?? 0.1,
        max_tokens: options.maxTokens ?? 1500,
        ...(options.json ? { response_format: { type: 'json_object' } } : {}),
      });

      const content = completion.choices[0]?.message?.content?.trim();
      if (!content) {
        throw new AiProviderError(502, 'Groq returned an empty response');
      }
      return content;
    } catch (err) {
      if (err instanceof AiProviderError) throw err;

      // Translate an OpenAI-SDK APIError (Groq is wire-compatible) into our
      // transport-agnostic error, preserving the upstream status.
      const status =
        err instanceof OpenAI.APIError && typeof err.status === 'number'
          ? err.status
          : 503;
      this.logger.warn(`Groq request failed (${status}): ${(err as Error).message}`);
      throw new AiProviderError(status, 'Groq request failed');
    }
  }
}
