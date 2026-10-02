/**
 * Cycle estimation is defined once in @lumen/shared so the API and the device
 * produce identical results. This module keeps the API-local import path used by
 * services and tests.
 */
export {
  estimateCycleContext,
  normalizePeriodStarts,
} from '@lumen/shared';
export type { CycleEventLike } from '@lumen/shared';
