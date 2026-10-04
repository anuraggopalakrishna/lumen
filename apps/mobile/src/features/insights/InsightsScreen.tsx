import {
  SYMPTOM_LABELS,
  type MetricSummary,
  type SymptomCode,
} from '@lumen/shared';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useDashboard } from '../dashboard/useDashboard';
import { colors, fonts, type } from '../../stores/theme';

const TREND_LABEL: Record<MetricSummary['trend'], string> = {
  up: 'Higher',
  down: 'Lower',
  flat: 'Steady',
  unknown: 'New',
};

const METRIC_LABELS: Record<string, string> = {
  energy: 'Energy',
  exhaustion: 'Exhaustion',
  sleep: 'Sleep',
  movement: 'Movement',
};

function format(metric: MetricSummary, value: number | null): string {
  if (value === null) return '--';
  return metric.metric === 'movement' ? value.toFixed(0) : value.toFixed(1);
}

/** Attach the unit to the score instead of floating it in its own column. */
function unitShort(unit: string): string {
  if (unit === 'of 5') return '/ 5';
  if (unit === 'hours') return 'h';
  if (unit === 'minutes') return 'min';
  return unit;
}

/**
 * Symptom codes are stored machine-first (`low_mood`, `sore_throat`). Never show
 * those raw — prefer the shared label and fall back to a humanized form for any
 * code the client does not yet know.
 */
function symptomLabel(code: string): string {
  const label = SYMPTOM_LABELS[code as SymptomCode];
  if (label) return label;
  const spaced = code.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
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
        {data.metrics.map((metric, index) => (
          <View
            key={metric.metric}
            style={[
              styles.row,
              index === data.metrics.length - 1 && styles.rowLast,
            ]}
          >
            <View style={styles.rowLeft}>
              <Text style={styles.metricName}>
                {METRIC_LABELS[metric.metric] ?? metric.metric}
              </Text>
              <Text style={styles.metricHint}>
                {TREND_LABEL[metric.trend]} vs 28-day average
              </Text>
            </View>
            <View style={styles.rowRight}>
              <Text style={styles.metricValue}>
                {format(metric, metric.avg3)}
                <Text style={styles.metricUnit}>
                  {' '}
                  {unitShort(metric.unit)}
                </Text>
              </Text>
              <Text style={styles.metricSub}>
                {format(metric, metric.avg28)} over 28d
              </Text>
            </View>
          </View>
        ))}
      </View>
      <Text style={styles.tableCaption}>
        Big number is your 3-day average. The line below it is your 28-day
        average.
      </Text>

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
              • {symptomLabel(symptom.symptomCode)}: {symptom.count7} in 7 days,{' '}
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
    fontSize: type.headline.fontSize,
    lineHeight: type.headline.lineHeight,
    fontWeight: '600',
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
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ECE9E2',
  },
  rowLeft: { flex: 1, paddingRight: 12 },
  rowRight: { alignItems: 'flex-end' },
  rowLast: { borderBottomWidth: 0 },
  metricName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  metricHint: {
    color: colors.textFaint,
    fontSize: 11,
    marginTop: 3,
  },
  metricValue: {
    color: colors.text,
    fontFamily: fonts.serif,
    fontSize: 22,
    fontWeight: '600',
  },
  metricUnit: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  metricSub: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  tableCaption: {
    color: colors.textFaint,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 10,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: fonts.serif,
    fontSize: type.section.fontSize,
    lineHeight: type.section.lineHeight,
    fontWeight: '600',
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
