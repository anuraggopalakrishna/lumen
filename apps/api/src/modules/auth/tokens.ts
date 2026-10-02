import { jwtVerify, SignJWT } from 'jose';

export type AccessClaims = {
  sub: string;
  sid: string;
};

export type TokenService = {
  signAccess(
    userId: string,
    sessionId: string,
  ): Promise<{ token: string; expiresAt: Date }>;
  verifyAccess(token: string): Promise<AccessClaims>;
};

export function createTokenService(
  secret: string,
  accessTokenTtlSeconds: number,
): TokenService {
  const key = new TextEncoder().encode(secret);

  return {
    async signAccess(userId, sessionId) {
      const expiresAt = new Date(Date.now() + accessTokenTtlSeconds * 1000);
      const token = await new SignJWT({ sid: sessionId })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(userId)
        .setIssuedAt()
        .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
        .sign(key);
      return { token, expiresAt };
    },

    async verifyAccess(token) {
      const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
      if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
        throw new Error('Malformed access token claims');
      }
      return { sub: payload.sub, sid: payload.sid };
    },
  };
}
