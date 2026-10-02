import {
  ACTIVITY_TYPES,
  SYMPTOM_CODES,
  SYMPTOM_LABELS,
  type ActivityType,
  type SymptomCode,
} from '@lumen/shared';
import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Toggle } from '../../components/Toggle';
import { todayLocalDate } from '../../lib/date';
import { colors, fonts } from '../../stores/theme';
import type { CheckInDraft } from '../../types';
import { saveCheckIn } from './saveCheckIn';

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  rest: 'Rest',
  walk: 'Walk',
  yoga: 'Yoga',
  strength: 'Strength',
  run: 'Run',
  cycle: 'Cycle',
  swim: 'Swim',
  other: 'Other',
};

const ACTIVITY_OPTIONS: ActivityType[] = [
  'rest',
  'walk',
  'yoga',
  'strength',
  'run',
  'cycle',
  'swim',
];

const DURATIONS = [10, 20, 30, 45, 60];
const SLEEP_HOURS = [5, 6, 7, 8, 9];
const SCALE = [1, 2, 3, 4, 5];

export function emptyDraft(localDate: string = todayLocalDate()): CheckInDraft {
  return {
    localDate,
    energy: 3,
    exhaustion: 3,
    mood: 3,
    stress: 3,
    movement: 'rest',
    durationMinutes: 20,
    sleepHours: 7,
    sleepQuality: 3,
    symptoms: [],
    note: '',
  };
}

function ScaleRow({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <View style={styles.scaleRow}>
      {SCALE.map((level) => (
        <Pressable
          key={level}
          onPress={() => onChange(level)}
          accessibilityRole="button"
          accessibilityState={{ selected: value === level }}
          style={[styles.scaleDot, value === level && styles.scaleDotActive]}
        >
          <Text style={styles.scaleText}>{level}</Text>
        </Pressable>
      ))}
    </View>
  );
}

type CheckInSheetProps = {
  visible: boolean;
  initial: CheckInDraft;
  onClose: () => void;
  onSaved: () => void;
};

export function CheckInSheet({
  visible,
  initial,
  onClose,
  onSaved,
}: CheckInSheetProps) {
  const [draft, setDraft] = useState<CheckInDraft>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setDraft(initial);
  }, [visible, initial]);

  const toggleSymptom = (code: SymptomCode) => {
    setDraft((current) => ({
      ...current,
      symptoms: current.symptoms.includes(code)
        ? current.symptoms.filter((item) => item !== code)
        : [...current.symptoms, code],
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveCheckIn(draft);
      onSaved();
      onClose();
    } catch (error) {
      Alert.alert(
        'Could not save',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.head}>
            <Pressable onPress={onClose}>
              <Text style={styles.close}>Cancel</Text>
            </Pressable>
            <Text style={styles.title}>Daily check-in</Text>
            <Pressable onPress={save} disabled={saving}>
              <Text style={styles.save}>{saving ? 'Saving…' : 'Save'}</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>ENERGY</Text>
          <ScaleRow
            value={draft.energy}
            onChange={(energy) => setDraft({ ...draft, energy })}
          />

          <Text style={styles.label}>EXHAUSTION</Text>
          <ScaleRow
            value={draft.exhaustion}
            onChange={(exhaustion) => setDraft({ ...draft, exhaustion })}
          />

          <Text style={styles.label}>MOOD</Text>
          <ScaleRow
            value={draft.mood}
            onChange={(mood) => setDraft({ ...draft, mood })}
          />

          <Text style={styles.label}>STRESS</Text>
          <ScaleRow
            value={draft.stress}
            onChange={(stress) => setDraft({ ...draft, stress })}
          />

          <Text style={styles.label}>MOVEMENT</Text>
          <View style={styles.chipRow}>
            {ACTIVITY_OPTIONS.map((option) => (
              <Toggle
                key={option}
                label={ACTIVITY_LABELS[option]}
                selected={draft.movement === option}
                onPress={() => setDraft({ ...draft, movement: option })}
              />
            ))}
          </View>

          {draft.movement !== 'rest' ? (
            <>
              <Text style={styles.label}>DURATION</Text>
              <View style={styles.chipRow}>
                {DURATIONS.map((minutes) => (
                  <Toggle
                    key={minutes}
                    label={`${minutes} min`}
                    selected={draft.durationMinutes === minutes}
                    onPress={() =>
                      setDraft({ ...draft, durationMinutes: minutes })
                    }
                  />
                ))}
              </View>
            </>
          ) : null}

          <Text style={styles.label}>SLEEP LAST NIGHT</Text>
          <View style={styles.chipRow}>
            {SLEEP_HOURS.map((hours) => (
              <Toggle
                key={hours}
                label={`${hours} h`}
                selected={draft.sleepHours === hours}
                onPress={() => setDraft({ ...draft, sleepHours: hours })}
              />
            ))}
          </View>
          <Text style={styles.subLabel}>SLEEP QUALITY</Text>
          <ScaleRow
            value={draft.sleepQuality}
            onChange={(sleepQuality) => setDraft({ ...draft, sleepQuality })}
          />

          <Text style={styles.label}>SYMPTOMS</Text>
          <View style={styles.chipRow}>
            {SYMPTOM_CODES.map((code) => (
              <Toggle
                key={code}
                label={SYMPTOM_LABELS[code]}
                selected={draft.symptoms.includes(code)}
                onPress={() => toggleSymptom(code)}
              />
            ))}
          </View>

          <Text style={styles.label}>A NOTE FOR FUTURE YOU</Text>
          <TextInput
            value={draft.note}
            onChangeText={(note) => setDraft({ ...draft, note })}
            multiline
            placeholder="What is your body telling you today?"
            placeholderTextColor="#9C9992"
            style={styles.note}
          />

          <View style={styles.privacy}>
            <Text style={styles.privacyIcon}>⌁</Text>
            <Text style={styles.privacyText}>
              Your check-ins are private. They are saved on this device first and
              synced when you are connected.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 22, paddingBottom: 45 },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  title: { color: colors.text, fontFamily: fonts.serif, fontSize: 22 },
  close: { color: colors.textMuted, fontSize: 15 },
  save: { color: '#3E7460', fontSize: 15, fontWeight: '800' },
  label: {
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 1.1,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 24,
  },
  subLabel: {
    color: colors.textMuted,
    fontSize: 11,
    letterSpacing: 1.1,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 16,
  },
  scaleRow: { flexDirection: 'row', justifyContent: 'space-between' },
  scaleDot: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#DAD6CE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scaleDotActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primarySoft,
  },
  scaleText: { color: '#4B4B44', fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  note: {
    height: 115,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E1DDD5',
    color: '#33332E',
    padding: 14,
    textAlignVertical: 'top',
    fontSize: 15,
    lineHeight: 21,
  },
  privacy: {
    flexDirection: 'row',
    backgroundColor: '#EEECE7',
    borderRadius: 15,
    padding: 15,
    marginTop: 27,
  },
  privacyIcon: { fontSize: 18, color: '#557B6B', marginRight: 10 },
  privacyText: { flex: 1, color: '#6B6861', fontSize: 12, lineHeight: 17 },
});
