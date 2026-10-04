import { useQuery } from '@tanstack/react-query';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SYMPTOM_LABELS } from '@lumen/shared';
import { formatLongDate } from '../../lib/date';
import { listLocalCheckIns } from '../../services/storage/db';
import { colors, fonts, type } from '../../stores/theme';

export function HistoryScreen() {
  const { data, isLoading } = useQuery({
    queryKey: ['history'],
    queryFn: () => listLocalCheckIns(120),
  });

  if (!isLoading && (!data || data.length === 0)) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>◫</Text>
        <Text style={styles.emptyTitle}>Your story, in context</Text>
        <Text style={styles.emptyBody}>
          Daily check-ins become a private timeline of your cycle, activity,
          symptoms, and recovery. Log one to begin.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>PRIVATE TIMELINE</Text>
      <Text style={styles.headline}>Your check-ins</Text>
      {data?.map((entry) => (
        <View key={entry.localDate} style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardDate}>{formatLongDate(entry.localDate)}</Text>
            <Text style={styles.cardSync}>
              {entry.synced ? 'Synced' : 'On this device'}
            </Text>
          </View>
          <Text style={styles.cardMetrics}>
            Energy {entry.energy}/5 · Exhaustion {entry.exhaustion}/5 · Mood{' '}
            {entry.mood}/5 · Stress {entry.stress}/5
          </Text>
          {entry.activities.length > 0 ? (
            <Text style={styles.cardDetail}>
              Movement:{' '}
              {entry.activities
                .map((activity) => `${activity.type} · ${activity.durationMinutes} min`)
                .join('  +  ')}
            </Text>
          ) : entry.movement !== 'rest' ? (
            <Text style={styles.cardDetail}>
              Movement: {entry.movement} · {entry.durationMinutes} min
            </Text>
          ) : null}
          {entry.sleepHours > 0 ? (
            <Text style={styles.cardDetail}>
              Sleep: {entry.sleepHours} h · quality {entry.sleepQuality}/5
            </Text>
          ) : null}
          {entry.symptoms.length > 0 ? (
            <Text style={styles.cardDetail}>
              Symptoms: {entry.symptoms.map((code) => SYMPTOM_LABELS[code]).join(', ')}
            </Text>
          ) : null}
          {entry.note ? <Text style={styles.cardNote}>“{entry.note}”</Text> : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 22, paddingBottom: 100 },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.25,
    marginTop: 8,
  },
  headline: {
    color: colors.text,
    fontFamily: fonts.serif,
    fontSize: type.headline.fontSize,
    lineHeight: type.headline.lineHeight,
    fontWeight: '600',
    marginTop: 6,
    marginBottom: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardDate: { color: colors.text, fontSize: 15, fontWeight: '700' },
  cardSync: { color: colors.textFaint, fontSize: 10, fontWeight: '700' },
  cardMetrics: { color: '#4B4A44', fontSize: 13, lineHeight: 19 },
  cardDetail: { color: colors.textMuted, fontSize: 13, marginTop: 3 },
  cardNote: {
    color: '#625C52',
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 8,
  },
  empty: {
    paddingTop: 80,
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  emptyIcon: { fontSize: 50, color: colors.primarySoft, marginBottom: 17 },
  emptyTitle: {
    color: colors.text,
    fontFamily: fonts.serif,
    fontSize: 22,
    lineHeight: 28,
    textAlign: 'center',
    marginBottom: 10,
  },
  emptyBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
});
