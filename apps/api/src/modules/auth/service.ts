import { createHash, randomBytes } from 'node:crypto';
import {
  CURRENT_POLICY_VERSION,
  type LoginInput,
  type RegisterInput,
  type SessionTokens,
} from '@lumen/shared';
import { and, eq, isNull, gt } from 'drizzle-orm';
import type { AppConfig } from '../../config.js';
import type { Database } from '../../db/client.js';
import {
  consents,
  devices,
  healthPreferences,
  profiles,
  sessions,
  users,
} from '../../db/schema.js';
import { AppError } from '../../errors.js';
import { recordAudit } from '../../lib/audit.js';
import { hashPassword, verifyPassword } from './passwords.js';
import type { TokenService } from './tokens.js';

export type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
  timezone: string;
};

export type AuthResult = {
  user: AuthUser;
  tokens: SessionTokens;
};

function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export class AuthService {
  constructor(
    private readonly db: Database,
    private readonly tokens: TokenService,
    private readonly config: AppConfig,
  ) {}

  private async createSession(
    tx: Pick<Database, 'insert'>,
    userId: string,
    deviceId: string | null,
  ) {
    const refreshToken = generateRefreshToken();
    const expiresAt = new Date(
      Date.now() + this.config.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
    );
    const [row] = await tx
      .insert(sessions)
      .values({
        userId,
        deviceId,
        refreshTokenHash: hashRefreshToken(refreshToken),
        expiresAt,
      })
      .returning({ id: sessions.id });
    if (!row) throw new Error('Failed to create session');
    return { sessionId: row.id, refreshToken, expiresAt };
  }

  private async upsertDevice(
    tx: Pick<Database, 'insert'>,
    userId: string,
    device: RegisterInput['device'],
  ): Promise<string | null> {
    if (!device) return null;
    const [row] = await tx
      .insert(devices)
      .values({
        userId,
        name: device.name,
        platform: device.platform,
        pushToken: device.pushToken ?? null,
      })
      .returning({ id: devices.id });
    return row?.id ?? null;
  }

  private async issue(
    userId: string,
    sessionId: string,
    refreshToken: string,
    refreshExpiresAt: Date,
  ): Promise<SessionTokens> {
    const access = await this.tokens.signAccess(userId, sessionId);
    return {
      accessToken: access.token,
      refreshToken,
      accessTokenExpiresAt: access.expiresAt.toISOString(),
      refreshTokenExpiresAt: refreshExpiresAt.toISOString(),
    };
  }

  async register(input: RegisterInput): Promise<AuthResult> {
    const email = input.email.toLowerCase();
    const passwordHash = await hashPassword(input.password);

    const result = await this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      if (existing) {
        throw AppError.conflict('An account with this email already exists');
      }

      const [user] = await tx
        .insert(users)
        .values({ email, passwordHash })
        .returning();
      if (!user) throw new Error('Failed to create user');

      await tx.insert(profiles).values({
        userId: user.id,
        displayName: input.displayName ?? null,
        timezone: input.timezone,
      });
      await tx.insert(healthPreferences).values({ userId: user.id });
      await tx.insert(consents).values({
        userId: user.id,
        purpose: 'account_operation',
        policyVersion: CURRENT_POLICY_VERSION,
        grantedAt: new Date(),
      });

      const deviceId = await this.upsertDevice(tx, user.id, input.device);
      const session = await this.createSession(tx, user.id, deviceId);
      return { user, session };
    });

    await recordAudit(this.db, result.user.id, 'account.created');
    const tokens = await this.issue(
      result.user.id,
      result.session.sessionId,
      result.session.refreshToken,
      result.session.expiresAt,
    );
    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        displayName: input.displayName ?? null,
        timezone: input.timezone,
      },
      tokens,
    };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const email = input.email.toLowerCase();
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (!user || user.status === 'deleted') {
      throw AppError.unauthorized('Invalid email or password');
    }
    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) throw AppError.unauthorized('Invalid email or password');

    const [profile] = await this.db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, user.id))
      .limit(1);

    const session = await this.db.transaction(async (tx) => {
      const deviceId = await this.upsertDevice(tx, user.id, input.device);
      return this.createSession(tx, user.id, deviceId);
    });

    await recordAudit(this.db, user.id, 'session.created');
    const tokens = await this.issue(
      user.id,
      session.sessionId,
      session.refreshToken,
      session.expiresAt,
    );
    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: profile?.displayName ?? null,
        timezone: profile?.timezone ?? 'UTC',
      },
      tokens,
    };
  }

  async refresh(refreshToken: string): Promise<SessionTokens> {
    const tokenHash = hashRefreshToken(refreshToken);
    const [session] = await this.db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.refreshTokenHash, tokenHash),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (!session) throw AppError.unauthorized('Invalid or expired refresh token');

    // Rotate: revoke the presented session and issue a fresh one.
    return this.db.transaction(async (tx) => {
      await tx
        .update(sessions)
        .set({ revokedAt: new Date() })
        .where(eq(sessions.id, session.id));
      const next = await this.createSession(tx, session.userId, session.deviceId);
      return this.issue(
        session.userId,
        next.sessionId,
        next.refreshToken,
        next.expiresAt,
      );
    });
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = hashRefreshToken(refreshToken);
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.refreshTokenHash, tokenHash));
  }

  async getMe(userId: string): Promise<AuthUser> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!user) throw AppError.notFound('User not found');
    const [profile] = await this.db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, user.id))
      .limit(1);
    return {
      id: user.id,
      email: user.email,
      displayName: profile?.displayName ?? null,
      timezone: profile?.timezone ?? 'UTC',
    };
  }
}
