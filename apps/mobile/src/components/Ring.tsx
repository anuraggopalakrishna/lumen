import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../stores/theme';

type RingProps = {
  /** 0-100, or null when there is no data for the window. */
  value: number | null;
  label: string;
  display?: string;
};

export function Ring({ value, label, display }: RingProps) {
  const tone = value === null ? colors.border : value >= 70 ? colors.primarySoft : '#D7B2A9';
  return (
    <View style={styles.wrap}>
      <View style={[styles.ring, { borderColor: tone }]}>
        <Text style={styles.number}>{display ?? (value === null ? '--' : value)}</Text>
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  ring: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: { color: '#292924', fontSize: 15, fontWeight: '700' },
  label: { color: colors.textMuted, marginTop: 8, fontSize: 12 },
});
