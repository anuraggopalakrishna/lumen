import { AppError } from '../../errors.js';

/**
 * Ollama boundary (§9). Production health-data inference must run against a
 * private, local Ollama server; the mobile app never reaches it directly. The
 * client:
 *  - constrains decoding with a JSON Schema via `format`
 *  - pins the model tag and resolves its digest for the run record
 *  - refuses to reach any host other than the configured private base URL
 */

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type OllamaChatRequest = {
  system: string;
  user: string;
  /** JSON Schema supplied to Ollama's `format` field. */
  format: Record<string, unknown>;
};

export type OllamaChatResponse = {
  text: string;
  model: string;
};

export type OllamaClient = {
  chat(request: OllamaChatRequest): Promise<OllamaChatResponse>;
  /** Digest of the pinned model, or null when it cannot be resolved. */
  resolveModelDigest(): Promise<string | null>;
};

export type OllamaClientOptions = {
  baseUrl: string;
  model: string;
  timeoutMs?: number;
  keepAlive?: string;
  numCtx?: number;
  fetchImpl?: FetchLike;
};

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_KEEP_ALIVE = '30m';
const DEFAULT_NUM_CTX = 4096;

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function createOllamaClient(options: OllamaClientOptions): OllamaClient {
  const baseUrl = options.baseUrl.replace(/\/+$/, '');
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const keepAlive = options.keepAlive ?? DEFAULT_KEEP_ALIVE;
  const numCtx = options.numCtx ?? DEFAULT_NUM_CTX;
  const doFetch: FetchLike = options.fetchImpl ?? fetch;

  async function withTimeout<T>(
    operation: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await operation(controller.signal);
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (controller.signal.aborted) {
        throw AppError.timeout('Local inference timed out');
      }
      throw AppError.unavailable(
        'Could not reach the local Ollama server. Check OLLAMA_BASE_URL and that the private inference host is running.',
      );
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async chat(request) {
      const body = {
        model: options.model,
        stream: false,
        keep_alive: keepAlive,
        format: request.format,
        messages: [
          { role: 'system', content: request.system },
          { role: 'user', content: request.user },
        ],
        options: { temperature: 0, num_ctx: numCtx },
      };

      const data = await withTimeout(async (signal) => {
        const response = await doFetch(`${baseUrl}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal,
        });
        if (!response.ok) {
          throw AppError.badGateway(
            `Local inference failed with status ${response.status}`,
          );
        }
        return readJson(response);
      });

      const record = data as {
        model?: unknown;
        message?: { content?: unknown };
      } | null;
      const content = record?.message?.content;
      if (typeof content !== 'string' || content.length === 0) {
        throw AppError.badGateway('Local inference returned no content');
      }
      return {
        text: content,
        model: typeof record?.model === 'string' ? record.model : options.model,
      };
    },

    async resolveModelDigest() {
      try {
        const data = await withTimeout(async (signal) => {
          const response = await doFetch(`${baseUrl}/api/tags`, { signal });
          if (!response.ok) return null;
          return readJson(response);
        });
        const models = (data as { models?: unknown } | null)?.models;
        if (!Array.isArray(models)) return null;
        const target = (
          models as Array<{ name?: string; model?: string; digest?: string }>
        ).find(
          (entry) =>
            entry.name === options.model || entry.model === options.model,
        );
        return target?.digest ?? null;
      } catch {
        // Digest capture is best-effort; a missing digest must not block a run.
        return null;
      }
    },
  };
}
