import type { MetricSummary } from '@lumen/shared';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDashboard } from '../dashboard/useDashboard';
import { colors, fonts } from '../../stores/theme';

const TREND_ARROW: Record<MetricSummary['trend'], string> = {
  up: '↑',
  down: '↓',
  flat: '→',
  unknown: '·',
};

function format(metric: MetricSummary, value: number | null): string {
  if (value === null) return '--';
  return metric.metric === 'movement' ? value.toFixed(0) : value.toFixed(1);
}

export function InsightsScreen() {
  const { data } = useDashboard();

  if (!data || data.evidence.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>✦</Text>
        <Text style={styles.emptyTitle}>Patterns need a little time</Text>
        <Text style={styles.emptyBody}>
          As you log more days, Lumen will describe your own trends here — with
          the window each one is based on and no invented causes.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>PERSONAL PATTERNS</Text>
      <Text style={styles.headline}>What your own data shows</Text>

      <View style={styles.table}>
        {data.metrics.map((metric) => (
          <View key={metric.metric} style={styles.row}>
            <Text style={styles.metricName}>{metric.metric}</Text>
            <Text style={styles.metricValue}>
              3d {format(metric, metric.avg3)} · 28d {format(metric, metric.avg28)}
            </Text>
            <Text style={styles.trend}>
              {TREND_ARROW[metric.trend]} {metric.unit}
            </Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>How we measured this</Text>
      {data.evidence.map((line) => (
        <Text key={line} style={styles.evidence}>
          • {line}
        </Text>
      ))}

      {data.symptoms.length > 0 ? (
        <>
          <Text style={styles.sectionTitle}>Symptoms logged</Text>
          {data.symptoms.slice(0, 6).map((symptom) => (
            <Text key={symptom.symptomCode} style={styles.evidence}>
              • {symptom.symptomCode}: {symptom.count7} in 7 days,{' '}
              {symptom.count28} in 28 days
            </Text>
          ))}
        </>
      ) : null}

      <Text style={styles.disclaimer}>{data.disclaimer}</Text>
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
    fontSize: 29,
    lineHeight: 36,
    marginTop: 8,
    marginBottom: 24,
  },
  table: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ECE9E2',
  },
  metricName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    textTransform: 'capitalize',
  },
  metricValue: { color: colors.textMuted, fontSize: 12, flex: 1.4 },
  trend: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  sectionTitle: {
    color: colors.text,
    fontFamily: fonts.serif,
    fontSize: 20,
    marginTop: 28,
    marginBottom: 10,
  },
  evidence: { color: '#55534D', fontSize: 13, lineHeight: 20, marginBottom: 6 },
  disclaimer: {
    color: colors.textFaint,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 28,
  },
  empty: { paddingTop: 80, alignItems: 'center', paddingHorizontal: 28 },
  emptyIcon: { fontSize: 46, color: colors.primarySoft, marginBottom: 17 },
  emptyTitle: {
    color: colors.text,
    fontFamily: fonts.serif,
    fontSize: 26,
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
