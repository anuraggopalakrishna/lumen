import type { DashboardToday, MetricSummary } from '@lumen/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ring } from '../components/Ring';
import { SectionHeader } from '../components/SectionHeader';
import { derivePlan } from '../features/dashboard/derivePlan';
import { useDashboard } from '../features/dashboard/useDashboard';
import { RecommendationsCard } from '../features/recommendations/RecommendationsCard';
import { logCycleEvent } from '../features/cycle/logCycleEvent';
import { formatLongDate, todayLocalDate } from '../lib/date';
import { listLocalCycleEvents } from '../services/storage/db';
import { useApp } from '../stores/AppProvider';
import { colors, fonts, type } from '../stores/theme';

const PHASE_LABELS: Record<DashboardToday['cycle']['phase'], string> = {
  menstrual: 'MENSTRUAL PHASE',
  follicular: 'FOLLICULAR PHASE',
  ovulation: 'OVULATION PHASE',
  luteal: 'LUTEAL PHASE',
  unknown: 'CYCLE',
};

function percentFromMetric(metric: MetricSummary | undefined): {
  value: number | null;
  display: string;
} {
  if (!metric) return { value: null, display: '--' };
  const raw = metric.today ?? metric.avg3 ?? metric.avg7;
  if (raw === null) return { value: null, display: '--' };
  if (metric.metric === 'sleep') {
    return {
      value: Math.min(100, Math.round((raw / 8) * 100)),
      display: raw.toFixed(1),
    };
  }
  if (metric.metric === 'movement') {
    return {
      value: Math.min(100, Math.round((raw / 30) * 100)),
      display: raw.toFixed(0),
    };
  }
  return { value: Math.round((raw / 5) * 100), display: raw.toFixed(1) };
}

type TodayScreenProps = {
  hasLoggedToday: boolean;
  onOpenCheckIn: () => void;
};

export function TodayScreen({
  hasLoggedToday,
  onOpenCheckIn,
}: TodayScreenProps) {
  const { status, pendingCount, lastSyncError, syncNow } = useApp();
  const queryClient = useQueryClient();
  const { data, isLoading } = useDashboard();
  const [loggingPeriod, setLoggingPeriod] = useState(false);
  const [startedToday, setStartedToday] = useState(false);
  const [endedToday, setEndedToday] = useState(false);
  const [showEndOption, setShowEndOption] = useState(false);
  const [periodDay, setPeriodDay] = useState<number | null>(null);
  const today = todayLocalDate();

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const events = await listLocalCycleEvents();
        if (!active) return;
        const starts = events
          .filter((e) => e.eventType === 'period_start' && e.eventDate <= today)
          .map((e) => e.eventDate)
          .sort();
        const lastStart = starts.length > 0 ? starts[starts.length - 1]! : null;
        const closed =
          lastStart !== null &&
          events.some(
            (e) =>
              e.eventType === 'period_end' &&
              e.eventDate >= lastStart &&
              e.eventDate <= today,
          );
        const daysSince =
          lastStart !== null
            ? Math.round(
                (Date.parse(`${today}T00:00:00Z`) -
                  Date.parse(`${lastStart}T00:00:00Z`)) /
                  86_400_000,
              )
            : null;
        const isActive = lastStart !== null && !closed;
        setStartedToday(
          events.some(
            (event) =>
              event.eventType === 'period_start' && event.eventDate === today,
          ),
        );
        setEndedToday(
          events.some(
            (event) =>
              event.eventType === 'period_end' && event.eventDate === today,
          ),
        );
        setShowEndOption(
          isActive && daysSince !== null && daysSince >= 3,
        );
        setPeriodDay(isActive && daysSince !== null ? daysSince + 1 : null);
      } catch {
        // Keep the button enabled; logging will surface any storage error.
      }
    })();
    return () => {
      active = false;
    };
  }, [today, data?.cycle?.cycleDay]);

  const energy = data?.metrics.find((m) => m.metric === 'energy');
  const sleep = data?.metrics.find((m) => m.metric === 'sleep');
  const movement = data?.metrics.find((m) => m.metric === 'movement');
  const plan = data ? derivePlan(data) : null;

  const onLogPeriod = async () => {
    if (loggingPeriod || startedToday) return;
    setLoggingPeriod(true);
    try {
      await logCycleEvent('period_start');
      setStartedToday(true);
      setPeriodDay(1);
      setShowEndOption(false);
    } catch (error) {
      Alert.alert(
        'Could not log period',
        error instanceof Error ? error.message : 'Please try again.',
      );
      return;
    } finally {
      setLoggingPeriod(false);
    }
    // Sync is best-effort: the period is already saved locally, so a sync
    // failure must never leave the button looking dead.
    try {
      await syncNow();
    } catch {
      // lastSyncError / pending count already reflect the queue state.
    } finally {
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  };

  const onLogPeriodEnd = async () => {
    if (loggingPeriod) return;
    setLoggingPeriod(true);
    try {
      await logCycleEvent('period_end');
      setEndedToday(true);
      setShowEndOption(false);
      setPeriodDay(null);
    } catch (error) {
      Alert.alert(
        'Could not log period end',
        error instanceof Error ? error.message : 'Please try again.',
      );
      return;
    } finally {
      setLoggingPeriod(false);
    }
    try {
      await syncNow();
    } catch {
      // Queued; sync status UI already reflects it.
    } finally {
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  };

  const cycle = data?.cycle;
  const cycleDay = cycle?.cycleDay ?? null;

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      <View style={styles.topRow}>
        <View>
          <Text style={styles.eyebrow}>
            {formatLongDate(todayLocalDate()).toUpperCase()}
          </Text>
          <Text style={styles.greeting}>
            {hasLoggedToday ? 'You checked in today.' : 'How are you feeling?'}
          </Text>
        </View>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>A</Text>
        </View>
      </View>

      <View style={styles.cycleCard}>
        <View style={styles.cardTopline}>
          <Text style={styles.cardKicker}>YOUR CYCLE</Text>
          <Text style={styles.phase}>
            {PHASE_LABELS[cycle?.phase ?? 'unknown']}
          </Text>
        </View>
        <View style={styles.cycleMiddle}>
          <View>
            <Text style={styles.cycleDay}>
              {cycleDay !== null ? `Day ${cycleDay}` : 'Not logged yet'}
            </Text>
            <Text style={styles.cycleCaption}>
              {cycle?.predictedPeriodInDays !== null &&
              cycle?.predictedPeriodInDays !== undefined
                ? cycle.predictedPeriodInDays >= 0
                  ? `Estimated period in ${cycle.predictedPeriodInDays} days`
                  : `Estimated period ${Math.abs(cycle.predictedPeriodInDays)} days ago`
                : 'Log a period start to estimate your phase'}
            </Text>
          </View>
          <View style={styles.moon}>
            <Text style={styles.moonIcon}>◒</Text>
          </View>
        </View>
        {endedToday ? (
          <Text
            style={styles.periodLoggedText}
            accessibilityLabel="Period ended"
          >
            ✓ Period ended
          </Text>
        ) : showEndOption ? (
        <Pressable
          onPress={onLogPeriodEnd}
          disabled={loggingPeriod}
          accessibilityRole="button"
          accessibilityLabel="Log period ended"
          accessibilityState={{
            disabled: loggingPeriod,
            busy: loggingPeriod,
          }}
          style={({ pressed }) => [
            styles.periodButton,
            pressed ? styles.periodButtonPressed : null,
            loggingPeriod && styles.periodButtonDisabled,
          ]}
        >
          <Text style={styles.periodButtonText}>
            {loggingPeriod ? 'Logging…' : 'Period ended?'}
          </Text>
        </Pressable>
        ) : startedToday || periodDay !== null ? (
          <Text
            style={styles.periodLoggedText}
            accessibilityLabel="Period logged for today"
          >
            {periodDay !== null && periodDay > 1
              ? `✓ Period logged · Day ${periodDay}`
              : '✓ Period logged'}
          </Text>
        ) : (
        <Pressable
          onPress={onLogPeriod}
          disabled={loggingPeriod}
          accessibilityRole="button"
          accessibilityLabel="Log period started today"
          accessibilityState={{
            disabled: loggingPeriod,
            busy: loggingPeriod,
          }}
          style={({ pressed }) => [
            styles.periodButton,
            pressed ? styles.periodButtonPressed : null,
            loggingPeriod && styles.periodButtonDisabled,
          ]}
        >
          <Text style={styles.periodButtonText}>
            {loggingPeriod ? 'Logging…' : 'Period started today'}
          </Text>
        </Pressable>
        )}
      </View>

      <SectionHeader title="Today at a glance" />
      <View style={styles.metricsCard}>
        {(() => {
          const energyRing = percentFromMetric(energy);
          const sleepRing = percentFromMetric(sleep);
          const movementRing = percentFromMetric(movement);
          return (
            <>
              <Ring
                value={energyRing.value}
                display={energyRing.display}
                label="Energy"
              />
              <View style={styles.divider} />
              <Ring
                value={sleepRing.value}
                display={sleepRing.display}
                label="Sleep"
              />
              <View style={styles.divider} />
              <Ring
                value={movementRing.value}
                display={movementRing.display}
                label="Movement"
              />
            </>
          );
        })()}
      </View>

      <SectionHeader title="Your gentle plan" />
      {plan ? (
        <View style={styles.planCard}>
          <View style={styles.planIcon}>
            <Text style={styles.planEmoji}>☼</Text>
          </View>
          <View style={styles.planText}>
            <Text style={styles.planTitle}>{plan.title}</Text>
            <Text style={styles.planBody}>{plan.body}</Text>
            <Text style={styles.planBasis}>
              ✦ BASED ON YOUR CHECK-INS · {plan.basis.toUpperCase()}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.planCard}>
          <View style={styles.planText}>
            <Text style={styles.planTitle}>
              {isLoading ? 'Reading your patterns…' : 'Nothing to suggest yet'}
            </Text>
            <Text style={styles.planBody}>
              Log a check-in to see a plan grounded in your own recent data.
            </Text>
          </View>
        </View>
      )}

      <SectionHeader title="Suggestions for you" />
      <RecommendationsCard />

      <Pressable onPress={onOpenCheckIn} style={styles.logButton}>
        <Text style={styles.logButtonPlus}>＋</Text>
        <Text style={styles.logButtonText}>
          {hasLoggedToday ? 'Edit today’s check-in' : 'Log how you feel'}
        </Text>
      </Pressable>

      <View style={styles.syncRow}>
        <Text style={styles.syncText}>
          {status === 'signedIn'
            ? pendingCount > 0
              ? `${pendingCount} change(s) waiting to sync`
              : 'All changes synced'
            : 'Saved on this device'}
        </Text>
        {status === 'signedIn' ? (
          <Pressable onPress={() => void syncNow()}>
            <Text style={styles.syncAction}>Sync now</Text>
          </Pressable>
        ) : null}
      </View>
      {lastSyncError ? (
        <Text style={styles.syncError}>{lastSyncError}</Text>
      ) : null}

      <Text style={styles.disclaimer}>
        Lumen offers wellbeing guidance, not medical advice.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 22, paddingBottom: 100 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 26,
  },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.25,
  },
  greeting: {
    color: colors.text,
    fontFamily: fonts.serif,
    fontSize: type.greeting.fontSize,
    lineHeight: type.greeting.lineHeight,
    fontWeight: '600',
    marginTop: 5,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#D8C4AD',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#514A3E', fontSize: 17, fontWeight: '700' },
  cycleCard: {
    backgroundColor: colors.cycleCard,
    borderRadius: 24,
    padding: 20,
    overflow: 'hidden',
  },
  cardTopline: { flexDirection: 'row', justifyContent: 'space-between' },
  cardKicker: {
    color: '#CAD7D2',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  phase: { color: '#A9D0C0', fontSize: 10, fontWeight: '700', letterSpacing: 0.7 },
  cycleMiddle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 18,
  },
  cycleDay: {
    color: '#FCFBF6',
    fontFamily: fonts.serif,
    fontSize: type.cycleDay.fontSize,
    lineHeight: type.cycleDay.lineHeight,
    fontWeight: '600',
  },
  cycleCaption: { color: '#C3CEC9', marginTop: 3, fontSize: 13, lineHeight: 18 },
  moon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.cycleCardSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moonIcon: { color: '#EFF1DC', fontSize: 38 },
  periodButton: {
    borderWidth: 1,
    borderColor: '#5C746A',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  periodButtonPressed: { backgroundColor: '#426258', opacity: 0.85 },
  periodButtonDisabled: { opacity: 0.7 },
  periodLoggedText: { color: '#C3CEC9', fontSize: 13, fontWeight: '700', textAlign: 'center', paddingVertical: 8 },
  periodButtonText: { color: '#CAD7D2', fontSize: 14, fontWeight: '700' },
  metricsCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 17,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  divider: { height: 48, width: 1, backgroundColor: '#ECE9E2' },
  planCard: {
    backgroundColor: colors.plan,
    borderRadius: 22,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  planIcon: {
    height: 38,
    width: 38,
    borderRadius: 19,
    backgroundColor: colors.planAccent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
    marginTop: 2,
    flexShrink: 0,
  },
  planEmoji: { fontSize: 21, color: '#FFF9E7' },
  planText: { flex: 1, justifyContent: 'center' },
  planTitle: {
    color: '#352F28',
    fontSize: type.cardTitle.fontSize,
    lineHeight: type.cardTitle.lineHeight,
    fontWeight: '700',
    marginBottom: 5,
  },
  planBody: { color: '#625C52', fontSize: 13, lineHeight: 19 },
  planBasis: {
    color: '#796849',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.55,
    marginTop: 12,
  },
  logButton: {
    backgroundColor: colors.primarySoft,
    borderRadius: 16,
    height: 59,
    marginTop: 28,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  logButtonText: { color: colors.primaryDeep, fontSize: 16, fontWeight: '700' },
  logButtonPlus: { color: colors.primaryDeep, fontSize: 22, marginRight: 8 },
  syncRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  syncText: { color: colors.textFaint, fontSize: 11 },
  syncAction: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  syncError: { color: '#9C4A3C', fontSize: 11, marginTop: 6 },
  disclaimer: {
    color: colors.textFaint,
    textAlign: 'center',
    fontSize: 11,
    marginTop: 15,
  },
});
