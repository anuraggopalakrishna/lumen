import type {
  LoginInput,
  RegisterInput,
  SessionTokens,
} from '@lumen/shared';
import { apiFetch } from './client';
import type { SessionUser } from '../../types';

export type AuthResponse = {
  user: SessionUser;
  tokens: SessionTokens;
};

export function register(input: RegisterInput): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/v1/auth/register', {
    method: 'POST',
    body: input,
    auth: false,
  });
}

export function login(input: LoginInput): Promise<AuthResponse> {
  return apiFetch<AuthResponse>('/v1/auth/login', {
    method: 'POST',
    body: input,
    auth: false,
  });
}

export function refresh(refreshToken: string): Promise<{ tokens: SessionTokens }> {
  return apiFetch<{ tokens: SessionTokens }>('/v1/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
    auth: false,
  });
}

export function logout(refreshToken: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>('/v1/auth/logout', {
    method: 'POST',
    body: { refreshToken },
    auth: false,
  });
}

export function me(): Promise<{ user: SessionUser }> {
  return apiFetch<{ user: SessionUser }>('/v1/auth/me');
}
