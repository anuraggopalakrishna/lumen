/**
 * Notification scheduling is consent-gated and off by default (§9, §11).
 * Phase 1 does not ship push; this module defines the boundary the app will use
 * once the `notifications` consent and a scheduling worker exist.
 */

export async function notificationsAvailable(): Promise<boolean> {
  return false;
}

export async function requestNotificationPermission(): Promise<boolean> {
  return false;
}

export async function scheduleDailyCheckInReminder(): Promise<void> {
  // Intentionally a no-op until consent, scheduling, and privacy review land.
}
