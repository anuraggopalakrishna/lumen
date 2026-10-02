import {
  healthPreferencesSchema,
  type HealthPreferences,
  type Profile,
  type UpdateHealthPreferencesInput,
  type UpdateProfileInput,
} from '@lumen/shared';
import { eq } from 'drizzle-orm';
import type { Database } from '../../db/client.js';
import { healthPreferences, profiles } from '../../db/schema.js';
import { AppError } from '../../errors.js';

export class ProfileService {
  constructor(private readonly db: Database) {}

  async getProfile(userId: string): Promise<Profile> {
    const [row] = await this.db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);
    if (!row) throw AppError.notFound('Profile not found');
    return {
      displayName: row.displayName,
      timezone: row.timezone,
      birthDate: row.birthDate,
    };
  }

  async updateProfile(
    userId: string,
    input: UpdateProfileInput,
  ): Promise<Profile> {
    const [row] = await this.db
      .update(profiles)
      .set({
        ...(input.displayName !== undefined
          ? { displayName: input.displayName }
          : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        ...(input.birthDate !== undefined ? { birthDate: input.birthDate } : {}),
        updatedAt: new Date(),
      })
      .where(eq(profiles.userId, userId))
      .returning();
    if (!row) throw AppError.notFound('Profile not found');
    return {
      displayName: row.displayName,
      timezone: row.timezone,
      birthDate: row.birthDate,
    };
  }

  async getPreferences(userId: string): Promise<HealthPreferences> {
    const [row] = await this.db
      .select()
      .from(healthPreferences)
      .where(eq(healthPreferences.userId, userId))
      .limit(1);
    if (!row) return healthPreferencesSchema.parse({});
    return {
      goals: row.goals,
      dietaryConstraints: row.dietaryConstraints,
      activityConstraints: row.activityConstraints,
      aiSharingEnabled: row.aiSharingEnabled,
    };
  }

  async updatePreferences(
    userId: string,
    input: UpdateHealthPreferencesInput,
  ): Promise<HealthPreferences> {
    const [row] = await this.db
      .update(healthPreferences)
      .set({
        ...(input.goals !== undefined ? { goals: input.goals } : {}),
        ...(input.dietaryConstraints !== undefined
          ? { dietaryConstraints: input.dietaryConstraints }
          : {}),
        ...(input.activityConstraints !== undefined
          ? { activityConstraints: input.activityConstraints }
          : {}),
        ...(input.aiSharingEnabled !== undefined
          ? { aiSharingEnabled: input.aiSharingEnabled }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(healthPreferences.userId, userId))
      .returning();
    if (!row) throw AppError.notFound('Preferences not found');
    return {
      goals: row.goals,
      dietaryConstraints: row.dietaryConstraints,
      activityConstraints: row.activityConstraints,
      aiSharingEnabled: row.aiSharingEnabled,
    };
  }

  async getTimezone(userId: string): Promise<string> {
    const [row] = await this.db
      .select({ timezone: profiles.timezone })
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);
    return row?.timezone ?? 'UTC';
  }
}
