const DEFAULT_BASE_URL = 'http://localhost:4000';

export const API_BASE_URL =
  (process.env.EXPO_PUBLIC_API_URL as string | undefined) ?? DEFAULT_BASE_URL;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Thrown when the device cannot reach the API; callers keep data queued. */
export class OfflineError extends Error {
  constructor(message = 'You appear to be offline') {
    super(message);
    this.name = 'OfflineError';
  }
}

export type TokenProvider = {
  getAccessToken(): Promise<string | null>;
  /** Attempt a refresh; resolve with a new access token or null. */
  refreshAccessToken(): Promise<string | null>;
};

let tokenProvider: TokenProvider | null = null;

export function setTokenProvider(provider: TokenProvider | null): void {
  tokenProvider = provider;
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  idempotencyKey?: string;
  signal?: AbortSignal;
};

async function rawFetch(
  path: string,
  options: RequestOptions,
  accessToken: string | null,
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch {
    throw new OfflineError();
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!response.ok) {
    const record = (data ?? {}) as { error?: string; message?: string; details?: unknown };
    throw new ApiError(
      response.status,
      record.error ?? 'request_failed',
      record.message ?? `Request failed (${response.status})`,
      record.details,
    );
  }
  return data as T;
}

/**
 * Fetch with bearer auth and a single transparent refresh-and-retry on 401.
 * Network failures surface as OfflineError so the queue can retain the write.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const requiresAuth = options.auth !== false;
  let accessToken = requiresAuth && tokenProvider ? await tokenProvider.getAccessToken() : null;

  let response = await rawFetch(path, options, accessToken);

  if (response.status === 401 && requiresAuth && tokenProvider) {
    const refreshed = await tokenProvider.refreshAccessToken();
    if (refreshed) {
      accessToken = refreshed;
      response = await rawFetch(path, options, accessToken);
    }
  }

  return parseResponse<T>(response);
}
