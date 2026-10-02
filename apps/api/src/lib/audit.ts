import type { Database } from '../db/client.js';
import { auditEvents } from '../db/schema.js';

/**
 * Record a privacy-sensitive action. Never include raw notes or symptom text in
 * metadata; audit events are operational, not a copy of health records.
 */
export async function recordAudit(
  db: Database,
  userId: string,
  eventType: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    await db.insert(auditEvents).values({ userId, eventType, metadata });
  } catch (error) {
    // Auditing must never break the user's action.
    // eslint-disable-next-line no-console
    console.error('Failed to record audit event', eventType, error);
  }
}
