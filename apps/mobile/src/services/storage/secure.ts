import * as SecureStore from 'expo-secure-store';
import type { SessionTokens } from '@lumen/shared';
import type { SessionUser } from '../../types';

/**
 * Only secrets and session references live in device-secure storage. Health
 * records stay in the local SQLite database.
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

export async function saveSession(
  tokens: SessionTokens,
  user: SessionUser,
): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken),
    SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
  ]);
}

export async function loadSession(): Promise<PersistedSession | null> {
  const [accessToken, refreshToken, userJson] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.getItemAsync(USER_KEY),
  ]);
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
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken),
    SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken),
  ]);
}

export async function clearSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(USER_KEY),
  ]);
}

export async function setLocalOnly(value: boolean): Promise<void> {
  if (value) await SecureStore.setItemAsync(LOCAL_ONLY_KEY, '1');
  else await SecureStore.deleteItemAsync(LOCAL_ONLY_KEY);
}

export async function isLocalOnly(): Promise<boolean> {
  return (await SecureStore.getItemAsync(LOCAL_ONLY_KEY)) === '1';
}
