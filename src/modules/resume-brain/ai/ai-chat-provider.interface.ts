/**
 * AiChatProvider — provider-agnostic contract for a chat-completion LLM.
 *
 * `AIExtractorService` depends only on this interface (via the
 * {@link AI_CHAT_PROVIDER} DI token), never on a concrete SDK. That is what
 * lets us ship with Groq today and swap in a Gemini implementation tomorrow
 * without touching a single line of the extractor.
 *
 *   AIExtractorService → AI_CHAT_PROVIDER → GroqProvider   (today)
 *                                        → GeminiProvider  (later, same shape)
 */

export type AiChatRole = 'system' | 'user' | 'assistant';

export interface AiChatMessage {
  role: AiChatRole;
  content: string;
}

export interface AiCompletionOptions {
  /** Upper bound on tokens generated. */
  maxTokens?: number;
  /** Sampling temperature. Extraction uses a low value for determinism. */
  temperature?: number;
  /** Ask the provider to guarantee a JSON object response when supported. */
  json?: boolean;
}

export interface AiChatProvider {
  /** Human-readable provider name, used in logs and for `modelUsed` metadata. */
  readonly name: string;

  /**
   * Run a chat completion and return the assistant message text verbatim.
   * Implementations MUST throw {@link AiProviderError} on failure so callers
   * can map provider HTTP status codes to the right API response.
   */
  complete(messages: AiChatMessage[], options?: AiCompletionOptions): Promise<string>;
}

/**
 * Transport-level failure from an AI provider, carrying the upstream HTTP
 * status so the service layer can translate (e.g. 429 → Too Many Requests).
 */
export class AiProviderError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AiProviderError';
  }
}

/** Nest DI token for the active {@link AiChatProvider} implementation. */
export const AI_CHAT_PROVIDER = Symbol('AI_CHAT_PROVIDER');