import {
  CONSENT_PURPOSES,
  type ConsentPurpose,
  type ConsentState,
} from '@lumen/shared';
import { desc, eq } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { consents, healthPreferences } from '../../db/schema.js';

function emptyState(purpose: ConsentPurpose): ConsentState {
  return {
    purpose,
    granted: false,
    policyVersion: null,
    grantedAt: null,
    revokedAt: null,
  };
}

export class ConsentService {
  constructor(private readonly db: Database) {}

  /** Latest decision per purpose, with all purposes represented. */
  async list(userId: string): Promise<ConsentState[]> {
    const rows = await this.db
      .select()
      .from(consents)
      .where(eq(consents.userId, userId))
      .orderBy(desc(consents.createdAt));

    const latest = new Map<ConsentPurpose, ConsentState>();
    for (const row of rows) {
      const purpose = row.purpose as ConsentPurpose;
      if (latest.has(purpose)) continue;
      latest.set(purpose, {
        purpose,
        granted: row.revokedAt === null && row.grantedAt !== null,
        policyVersion: row.policyVersion,
        grantedAt: row.grantedAt?.toISOString() ?? null,
        revokedAt: row.revokedAt?.toISOString() ?? null,
      });
    }
    return CONSENT_PURPOSES.map(
      (purpose) => latest.get(purpose) ?? emptyState(purpose),
    );
  }

  async isGranted(userId: string, purpose: ConsentPurpose): Promise<boolean> {
    const decisions = await this.db
      .select()
      .from(consents)
      .where(eq(consents.userId, userId))
      .orderBy(desc(consents.createdAt));
    const match = decisions.find((decision) => decision.purpose === purpose);
    return Boolean(
      match && match.revokedAt === null && match.grantedAt !== null,
    );
  }

  async decide(
    userId: string,
    purpose: ConsentPurpose,
    granted: boolean,
    policyVersion: string,
  ): Promise<void> {
    const now = new Date();
    await this.db.transaction(async (tx) => {
      await tx.insert(consents).values({
        userId,
        purpose,
        policyVersion,
        grantedAt: granted ? now : null,
        revokedAt: granted ? null : now,
      });
      if (purpose === 'ai_processing') {
        await tx
          .update(healthPreferences)
          .set({ aiSharingEnabled: granted, updatedAt: now })
          .where(eq(healthPreferences.userId, userId));
      }
    });
  }
}
