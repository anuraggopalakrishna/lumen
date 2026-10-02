import { Pressable, StyleSheet, Text } from 'react-native';
import { colors } from '../stores/theme';

type ToggleProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

export function Toggle({ label, selected, onPress }: ToggleProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.text, selected && styles.textSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderColor: '#D9D5CD',
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 18,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: '#DDEBE4', borderColor: '#9DC2B1' },
  text: { color: '#5E5C56', fontSize: 13 },
  textSelected: { color: '#2D5F4D', fontWeight: '700' },
});
