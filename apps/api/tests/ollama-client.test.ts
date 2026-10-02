import { describe, expect, it } from 'vitest';
import { createOllamaClient } from '../src/modules/ai/ollama-client.js';

function jsonResponse(payload: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    text: async () => JSON.stringify(payload),
  } as unknown as Response;
}

const chatRequest = {
  system: 'system prompt',
  user: 'user prompt',
  format: { type: 'object' },
};

describe('createOllamaClient.chat', () => {
  it('posts a schema-constrained, non-streaming chat to the pinned model', async () => {
    let captured: { url: string; body: Record<string, unknown> } | null = null;
    const client = createOllamaClient({
      baseUrl: 'http://127.0.0.1:11434/',
      model: 'qwen3:4b',
      timeoutMs: 1000,
      fetchImpl: async (url, init) => {
        captured = {
          url,
          body: JSON.parse(String(init?.body)),
        };
        return jsonResponse({
          model: 'qwen3:4b',
          message: { content: '{"suggestions":[]}' },
        });
      },
    });

    const result = await client.chat(chatRequest);
    expect(result.text).toBe('{"suggestions":[]}');
    expect(captured).not.toBeNull();
    const { url, body } = captured as unknown as {
      url: string;
      body: Record<string, unknown>;
    };
    expect(url).toBe('http://127.0.0.1:11434/api/chat');
    expect(body.model).toBe('qwen3:4b');
    expect(body.stream).toBe(false);
    expect(body.format).toEqual({ type: 'object' });
    expect((body.options as { temperature: number }).temperature).toBe(0);
    expect(body.messages).toEqual([
      { role: 'system', content: 'system prompt' },
      { role: 'user', content: 'user prompt' },
    ]);
  });

  it('maps a non-OK inference response to a bad gateway error', async () => {
    const client = createOllamaClient({
      baseUrl: 'http://127.0.0.1:11434',
      model: 'qwen3:4b',
      fetchImpl: async () => jsonResponse({ error: 'boom' }, false, 500),
    });
    await expect(client.chat(chatRequest)).rejects.toMatchObject({
      statusCode: 502,
      code: 'bad_gateway',
    });
  });

  it('maps an unreachable host to a service-unavailable error', async () => {
    const client = createOllamaClient({
      baseUrl: 'http://127.0.0.1:11434',
      model: 'qwen3:4b',
      fetchImpl: async () => {
        throw new Error('ECONNREFUSED');
      },
    });
    await expect(client.chat(chatRequest)).rejects.toMatchObject({
      statusCode: 503,
      code: 'service_unavailable',
    });
  });

  it('maps an aborted request to a timeout error', async () => {
    const client = createOllamaClient({
      baseUrl: 'http://127.0.0.1:11434',
      model: 'qwen3:4b',
      timeoutMs: 20,
      fetchImpl: (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new Error('aborted')),
          );
        }),
    });
    await expect(client.chat(chatRequest)).rejects.toMatchObject({
      statusCode: 504,
      code: 'timeout',
    });
  });
});

describe('createOllamaClient.resolveModelDigest', () => {
  it('reads the digest of the pinned model from /api/tags', async () => {
    const client = createOllamaClient({
      baseUrl: 'http://127.0.0.1:11434',
      model: 'qwen3:4b',
      fetchImpl: async () =>
        jsonResponse({
          models: [
            { name: 'llama3.2:3b', digest: 'other' },
            { name: 'qwen3:4b', digest: 'sha256-abc' },
          ],
        }),
    });
    expect(await client.resolveModelDigest()).toBe('sha256-abc');
  });

  it('returns null when the model is absent', async () => {
    const client = createOllamaClient({
      baseUrl: 'http://127.0.0.1:11434',
      model: 'qwen3:4b',
      fetchImpl: async () => jsonResponse({ models: [] }),
    });
    expect(await client.resolveModelDigest()).toBeNull();
  });
});
