import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../stores/theme';
import type { NavTab } from '../types';

const TABS: Array<{ key: NavTab; icon: string }> = [
  { key: 'Today', icon: '◉' },
  { key: 'History', icon: '▦' },
  { key: 'Insights', icon: '✦' },
  { key: 'Profile', icon: '◌' },
];

type TabBarProps = {
  active: NavTab;
  onChange: (tab: NavTab) => void;
};

export function TabBar({ active, onChange }: TabBarProps) {
  return (
    <View style={styles.bar}>
      {TABS.map((tab) => (
        <Pressable
          key={tab.key}
          onPress={() => onChange(tab.key)}
          style={styles.item}
          accessibilityRole="tab"
          accessibilityState={{ selected: active === tab.key }}
        >
          <Text style={[styles.icon, active === tab.key && styles.active]}>
            {tab.icon}
          </Text>
          <Text style={[styles.text, active === tab.key && styles.active]}>
            {tab.key}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    height: 76,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: '#EBE7E0',
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 11,
  },
  item: { alignItems: 'center', minWidth: 58 },
  icon: { color: '#A19E97', fontSize: 20, height: 28 },
  active: { color: '#477361' },
  text: { color: '#A19E97', fontSize: 10, fontWeight: '600' },
});
