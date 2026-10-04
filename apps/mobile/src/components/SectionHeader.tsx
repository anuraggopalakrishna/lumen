import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, type } from '../stores/theme';

type SectionHeaderProps = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function SectionHeader({ title, actionLabel, onAction }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {actionLabel ? (
        <Pressable onPress={onAction} disabled={!onAction}>
          <Text style={styles.action}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 29,
    marginBottom: 12,
  },
  title: {
    fontFamily: fonts.serif,
    fontSize: type.section.fontSize,
    lineHeight: type.section.lineHeight,
    fontWeight: '600',
    color: colors.text,
  },
  action: { color: '#5B8577', fontSize: 13, fontWeight: '700' },
});
