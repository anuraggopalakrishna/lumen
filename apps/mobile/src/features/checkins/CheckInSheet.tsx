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

/**
 * The 1–5 scales are stored as numbers, but numbers are not intuitive to pick
 * from. Each point is presented with a short word so the choice is about how
 * you feel rather than a rank.
 */
const SCALE_LABELS = {
  energy: ['Very low', 'Low', 'Okay', 'Good', 'High'],
  exhaustion: ['None', 'Mild', 'Some', 'High', 'Severe'],
  mood: ['Very low', 'Low', 'Okay', 'Good', 'Great'],
  stress: ['None', 'Mild', 'Some', 'High', 'Severe'],
  sleepQuality: ['Poor', 'Fair', 'Okay', 'Good', 'Great'],
} as const;

export function emptyDraft(localDate: string = todayLocalDate()): CheckInDraft {
  return {
    localDate,
    energy: 3,
    exhaustion: 3,
    mood: 3,
    stress: 3,
    movement: 'rest',
    durationMinutes: 20,
    activities: [],
    sleepHours: 7,
    sleepQuality: 3,
    symptoms: [],
    note: '',
  };
}

function ScaleRow({
  value,
  onChange,
  labels,
}: {
  value: number;
  onChange: (value: number) => void;
  labels: readonly string[];
}) {
  return (
    <View style={styles.scaleRow}>
      {SCALE.map((level, index) => {
        const active = value === level;
        return (
          <Pressable
            key={level}
            onPress={() => onChange(level)}
            accessibilityRole="button"
            accessibilityLabel={labels[index]}
            accessibilityState={{ selected: active }}
            style={[styles.scaleOption, active && styles.scaleOptionActive]}
          >
            <Text
              style={[styles.scaleText, active && styles.scaleTextActive]}
            >
              {labels[index]}
            </Text>
          </Pressable>
        );
      })}
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
    if (visible) {
      if (
        initial.activities.length === 0 &&
        initial.movement !== 'rest' &&
        initial.durationMinutes > 0
      ) {
        setDraft({
          ...initial,
          activities: [
            {
              type: initial.movement,
              durationMinutes: initial.durationMinutes,
            },
          ],
        });
      } else {
        setDraft(initial);
      }
    }
  }, [visible, initial]);

  const toggleSymptom = (code: SymptomCode) => {
    setDraft((current) => ({
      ...current,
      symptoms: current.symptoms.includes(code)
        ? current.symptoms.filter((item) => item !== code)
        : [...current.symptoms, code],
    }));
  };

  const toggleActivity = (type: ActivityType) => {
    if (type === 'rest') {
      setDraft((current) => ({
        ...current,
        activities: [],
        movement: 'rest',
      }));
      return;
    }
    setDraft((current) => {
      const clean = current.activities.filter((entry) => entry.type !== 'rest');
      const existing = clean.find((entry) => entry.type === type);
      const activities = existing
        ? clean.filter((entry) => entry.type !== type)
        : [
            ...clean,
            { type, durationMinutes: current.durationMinutes || 20 },
          ];
      const primary = activities[0];
      return {
        ...current,
        activities,
        movement: primary ? primary.type : 'rest',
        durationMinutes: primary
          ? activities.reduce((sum, entry) => sum + entry.durationMinutes, 0)
          : current.durationMinutes,
      };
    });
  };

  const setActivityDuration = (type: ActivityType, durationMinutes: number) => {
    setDraft((current) => {
      const activities = current.activities.map((entry) =>
        entry.type === type ? { ...entry, durationMinutes } : entry,
      );
      return {
        ...current,
        activities,
        durationMinutes: activities.reduce(
          (sum, entry) => sum + entry.durationMinutes,
          0,
        ),
      };
    });
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
            labels={SCALE_LABELS.energy}
            onChange={(energy) => setDraft({ ...draft, energy })}
          />

          <Text style={styles.label}>EXHAUSTION</Text>
          <ScaleRow
            value={draft.exhaustion}
            labels={SCALE_LABELS.exhaustion}
            onChange={(exhaustion) => setDraft({ ...draft, exhaustion })}
          />

          <Text style={styles.label}>MOOD</Text>
          <ScaleRow
            value={draft.mood}
            labels={SCALE_LABELS.mood}
            onChange={(mood) => setDraft({ ...draft, mood })}
          />

          <Text style={styles.label}>STRESS</Text>
          <ScaleRow
            value={draft.stress}
            labels={SCALE_LABELS.stress}
            onChange={(stress) => setDraft({ ...draft, stress })}
          />

          <Text style={styles.label}>MOVEMENT · PICK ANY THAT APPLY</Text>
          <View style={styles.chipRow}>
            <Toggle
              label="Rest"
              selected={draft.activities.length === 0}
              onPress={() =>
                setDraft({
                  ...draft,
                  activities: [],
                  movement: 'rest',
                  durationMinutes: draft.durationMinutes || 20,
                })
              }
            />
            {ACTIVITY_OPTIONS.map((option) => (
              <Toggle
                key={option}
                label={ACTIVITY_LABELS[option]}
                selected={draft.activities.some(
                  (entry) => entry.type === option,
                )}
                onPress={() => toggleActivity(option)}
              />
            ))}
            <Toggle
              label={ACTIVITY_LABELS.other}
              selected={draft.activities.some((entry) => entry.type === 'other')}
              onPress={() => toggleActivity('other')}
            />
          </View>

          {draft.activities.map((entry) => (
            <View key={entry.type} style={styles.activityBlock}>
              <Text style={styles.subLabel}>
                {ACTIVITY_LABELS[entry.type].toUpperCase()} · DURATION
              </Text>
              <View style={styles.chipRow}>
                {DURATIONS.map((minutes) => (
                  <Toggle
                    key={minutes}
                    label={`${minutes} min`}
                    selected={entry.durationMinutes === minutes}
                    onPress={() => setActivityDuration(entry.type, minutes)}
                  />
                ))}
              </View>
            </View>
          ))}

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
            labels={SCALE_LABELS.sleepQuality}
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
  scaleRow: { flexDirection: 'row', gap: 6 },
  scaleOption: {
    flex: 1,
    minHeight: 58,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#DAD6CE',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    paddingVertical: 6,
  },
  scaleOptionActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primarySoft,
  },
  scaleText: {
    color: '#4B4B44',
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  scaleTextActive: { color: colors.primaryDeep, fontWeight: '800' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  activityBlock: { marginTop: 4 },
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
