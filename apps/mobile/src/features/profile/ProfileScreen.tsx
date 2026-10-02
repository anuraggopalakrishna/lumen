import { CURRENT_POLICY_VERSION, type ConsentPurpose } from '@lumen/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { listConsents, setConsent } from '../../services/api/consent';
import { deleteAccount, exportData } from '../../services/api/privacy';
import { useApp } from '../../stores/AppProvider';
import { colors, fonts } from '../../stores/theme';

const CONSENT_LABELS: Partial<Record<ConsentPurpose, string>> = {
  ai_processing: 'Allow AI processing of my features',
  notifications: 'Allow check-in reminders',
  sharing: 'Future sharing with others',
};

export function ProfileScreen() {
  const { status, user, pendingCount, lastSyncError, syncNow, signOut } = useApp();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const signedIn = status === 'signedIn';

  const { data: consentData } = useQuery({
    queryKey: ['consents'],
    queryFn: listConsents,
    enabled: signedIn,
  });

  const onExport = async () => {
    setBusy(true);
    try {
      const data = await exportData();
      Alert.alert(
        'Export ready',
        `A machine-readable copy of your data was generated (${JSON.stringify(data).length.toLocaleString()} characters). It includes your check-ins, cycle events, symptoms, activity, sleep, features, and consent history.`,
      );
    } catch (error) {
      Alert.alert(
        'Export failed',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const onDelete = () => {
    Alert.alert(
      'Delete account?',
      'This starts a verified deletion workflow. Your health records will be erased and your account anonymized.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusy(true);
              try {
                await deleteAccount();
                await signOut();
              } catch (error) {
                Alert.alert(
                  'Could not delete',
                  error instanceof Error ? error.message : 'Please try again.',
                );
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ],
    );
  };

  const toggleConsent = async (purpose: ConsentPurpose, granted: boolean) => {
    try {
      await setConsent(purpose, granted, CURRENT_POLICY_VERSION);
      await queryClient.invalidateQueries({ queryKey: ['consents'] });
    } catch (error) {
      Alert.alert(
        'Could not update consent',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.displayName ?? user?.email ?? 'L').charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.name}>
          {user?.displayName ?? (signedIn ? user?.email : 'Local mode')}
        </Text>
        <Text style={styles.subtitle}>
          {signedIn
            ? user?.email
            : 'Your data stays on this device until you sign in.'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sync</Text>
        <Text style={styles.cardBody}>
          {!signedIn
            ? 'Offline only. Sign in to back up and sync across sessions.'
            : pendingCount > 0
              ? `${pendingCount} change(s) waiting to sync.`
              : 'Everything is synced.'}
        </Text>
        {lastSyncError ? (
          <Text style={styles.error}>{lastSyncError}</Text>
        ) : null}
        <View style={styles.cardActions}>
          {signedIn ? (
            <Pressable onPress={() => void syncNow()} disabled={busy}>
              <Text style={styles.link}>Sync now</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => void signOut()}>
            <Text style={styles.link}>{signedIn ? 'Sign out' : 'Sign in'}</Text>
          </Pressable>
        </View>
      </View>

      {signedIn ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Consent</Text>
          {(Object.keys(CONSENT_LABELS) as ConsentPurpose[]).map((purpose) => {
            const state = consentData?.consents.find(
              (entry) => entry.purpose === purpose,
            );
            const granted = state?.granted ?? false;
            const disabled = purpose === 'sharing';
            return (
              <View key={purpose} style={styles.consentRow}>
                <Text style={styles.consentLabel}>
                  {CONSENT_LABELS[purpose]}
                  {disabled ? ' (not available yet)' : ''}
                </Text>
                <Switch
                  value={granted}
                  disabled={disabled}
                  onValueChange={(value) => void toggleConsent(purpose, value)}
                />
              </View>
            );
          })}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your data</Text>
        <Text style={styles.cardBody}>
          Export a portable copy, or delete your account and health records. AI
          processing is off unless you consent to it.
        </Text>
        <View style={styles.cardActions}>
          <Pressable onPress={() => void onExport()} disabled={!signedIn || busy}>
            <Text style={[styles.link, !signedIn && styles.linkDisabled]}>
              Export my data
            </Text>
          </Pressable>
          <Pressable onPress={onDelete} disabled={!signedIn || busy}>
            <Text style={[styles.linkDanger, !signedIn && styles.linkDisabled]}>
              Delete account
            </Text>
          </Pressable>
        </View>
        {busy ? <ActivityIndicator color={colors.primary} /> : null}
      </View>

      <Text style={styles.disclaimer}>
        Lumen is a wellbeing tool. It does not diagnose, treat, or replace
        professional care.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 22, paddingBottom: 110 },
  header: { alignItems: 'center', paddingTop: 40, marginBottom: 26 },
  avatar: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#D8C4AD',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: { color: '#514A3E', fontSize: 28, fontWeight: '700' },
  name: { color: colors.text, fontFamily: fonts.serif, fontSize: 25 },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 5 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
  },
  cardTitle: {
    color: colors.text,
    fontFamily: fonts.serif,
    fontSize: 19,
    marginBottom: 8,
  },
  cardBody: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  cardActions: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 14,
    alignItems: 'center',
  },
  link: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  linkDisabled: { color: '#B9B6AF' },
  linkDanger: { color: colors.danger, fontSize: 14, fontWeight: '700' },
  error: { color: colors.danger, fontSize: 12, marginTop: 8 },
  consentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  consentLabel: { flex: 1, color: '#45443F', fontSize: 14, marginRight: 12 },
  disclaimer: {
    color: colors.textFaint,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 10,
  },
});
