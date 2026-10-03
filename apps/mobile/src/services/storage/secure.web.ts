import type { SessionTokens } from '@lumen/shared';
import type { SessionUser } from '../../types';

/**
 * Web fallback for secure storage. `expo-secure-store` has no web
 * implementation, so the browser build persists session references in
 * `localStorage` instead. This is a development convenience only: on a real
 * device the native `secure.ts` (Keychain / Keystore) is used.
 */
const ACCESS_TOKEN_KEY = 'lumen.access_token';
const REFRESH_TOKEN_KEY = 'lumen.refresh_token';
const USER_KEY = 'lumen.user';
const LOCAL_ONLY_KEY = 'lumen.local_only';

export type PersistedSession = {
  accessToken: string;
  refreshToken: string;
  user: SessionUser;
};

function getStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

function read(key: string): string | null {
  return getStorage()?.getItem(key) ?? null;
}

function write(key: string, value: string): void {
  getStorage()?.setItem(key, value);
}

function remove(key: string): void {
  getStorage()?.removeItem(key);
}

export async function saveSession(
  tokens: SessionTokens,
  user: SessionUser,
): Promise<void> {
  write(ACCESS_TOKEN_KEY, tokens.accessToken);
  write(REFRESH_TOKEN_KEY, tokens.refreshToken);
  write(USER_KEY, JSON.stringify(user));
}

export async function loadSession(): Promise<PersistedSession | null> {
  const accessToken = read(ACCESS_TOKEN_KEY);
  const refreshToken = read(REFRESH_TOKEN_KEY);
  const userJson = read(USER_KEY);
  if (!accessToken || !refreshToken || !userJson) return null;
  try {
    return {
      accessToken,
      refreshToken,
      user: JSON.parse(userJson) as SessionUser,
    };
  } catch {
    return null;
  }
}

export async function updateTokens(tokens: SessionTokens): Promise<void> {
  write(ACCESS_TOKEN_KEY, tokens.accessToken);
  write(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export async function clearSession(): Promise<void> {
  remove(ACCESS_TOKEN_KEY);
  remove(REFRESH_TOKEN_KEY);
  remove(USER_KEY);
}

export async function setLocalOnly(value: boolean): Promise<void> {
  if (value) write(LOCAL_ONLY_KEY, '1');
  else remove(LOCAL_ONLY_KEY);
}

export async function isLocalOnly(): Promise<boolean> {
  return read(LOCAL_ONLY_KEY) === '1';
}
