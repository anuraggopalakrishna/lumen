import { useQuery, useQueryClient } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  View,
} from 'react-native';
import { TabBar } from '../components/TabBar';
import { CheckInSheet, emptyDraft } from '../features/checkins/CheckInSheet';
import { HistoryScreen } from '../features/history/HistoryScreen';
import { InsightsScreen } from '../features/insights/InsightsScreen';
import { ProfileScreen } from '../features/profile/ProfileScreen';
import { todayLocalDate } from '../lib/date';
import { getLocalCheckIn } from '../services/storage/db';
import { useApp } from '../stores/AppProvider';
import { colors } from '../stores/theme';
import type { LocalCheckIn, NavTab } from '../types';
import { AuthScreen } from './AuthScreen';
import { TodayScreen } from './TodayScreen';

function toDraft(record: LocalCheckIn) {
  return {
    localDate: record.localDate,
    energy: record.energy,
    exhaustion: record.exhaustion,
    mood: record.mood,
    stress: record.stress,
    movement: record.movement,
    durationMinutes: record.durationMinutes,
    sleepHours: record.sleepHours,
    sleepQuality: record.sleepQuality,
    symptoms: record.symptoms,
    note: record.note,
  };
}

export function RootNavigator() {
  const { status } = useApp();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<NavTab>('Today');
  const [showLog, setShowLog] = useState(false);
  const today = todayLocalDate();

  const todayQuery = useQuery({
    queryKey: ['today-check-in', today],
    queryFn: () => getLocalCheckIn(today),
    enabled: status === 'signedIn' || status === 'localOnly',
  });

  if (status === 'loading') {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (status === 'signedOut') {
    return <AuthScreen />;
  }

  const initial = todayQuery.data ? toDraft(todayQuery.data) : emptyDraft(today);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.app}>
        {tab === 'Today' ? (
          <TodayScreen
            hasLoggedToday={Boolean(todayQuery.data)}
            onOpenCheckIn={() => setShowLog(true)}
          />
        ) : null}
        {tab === 'History' ? <HistoryScreen /> : null}
        {tab === 'Insights' ? <InsightsScreen /> : null}
        {tab === 'Profile' ? <ProfileScreen /> : null}
        <TabBar active={tab} onChange={setTab} />
      </View>
      <CheckInSheet
        visible={showLog}
        initial={initial}
        onClose={() => setShowLog(false)}
        onSaved={() => {
          void queryClient.invalidateQueries();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  app: { flex: 1 },
  splash: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
