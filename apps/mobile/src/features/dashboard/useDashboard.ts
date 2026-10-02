import { useQuery } from '@tanstack/react-query';
import type { DashboardToday } from '@lumen/shared';
import { todayLocalDate } from '../../lib/date';
import { getDashboard } from '../../services/api/healthLog';
import {
  listLocalCheckIns,
  listLocalCycleEvents,
} from '../../services/storage/db';
import { useApp } from '../../stores/AppProvider';
import { buildLocalDashboard } from './localDashboard';

/**
 * The Today read model. When signed in and reachable it uses the backend; the
 * local, deterministic dashboard is the offline fallback so the screen always
 * has something honest to show.
 */
export function useDashboard(date: string = todayLocalDate()) {
  const { status } = useApp();
  return useQuery({
    queryKey: ['dashboard', date, status],
    queryFn: async (): Promise<DashboardToday> => {
      if (status === 'signedIn') {
        try {
          return await getDashboard(date);
        } catch {
          // Fall through to the local model.
        }
      }
      const [checkIns, cycleEvents] = await Promise.all([
        listLocalCheckIns(28),
        listLocalCycleEvents(),
      ]);
      return buildLocalDashboard(date, checkIns, cycleEvents);
    },
  });
}
