import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { PrimaryButton } from '../components/PrimaryButton';
import { useApp } from '../stores/AppProvider';
import { colors, fonts } from '../stores/theme';

function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function AuthScreen() {
  const { signIn, signUp, continueOffline } = useApp();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'signIn') {
        await signIn({ email: email.trim(), password });
      } else {
        await signUp({
          email: email.trim(),
          password,
          timezone: deviceTimezone(),
          ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
        });
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : 'Something went wrong.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.eyebrow}>LUMEN</Text>
        <Text style={styles.title}>
          {mode === 'signIn' ? 'Welcome back' : 'Create your space'}
        </Text>
        <Text style={styles.subtitle}>
          A private place for your cycle, energy, and recovery patterns.
        </Text>

        {mode === 'signUp' ? (
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Name (optional)"
            placeholderTextColor="#9C9992"
            autoCapitalize="words"
            style={styles.input}
          />
        ) : null}

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor="#9C9992"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          style={styles.input}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password (8+ characters)"
          placeholderTextColor="#9C9992"
          secureTextEntry
          style={styles.input}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {busy ? (
          <ActivityIndicator color={colors.primary} style={styles.spinner} />
        ) : null}

        <View style={styles.actions}>
          <PrimaryButton
            label={mode === 'signIn' ? 'Sign in' : 'Create account'}
            onPress={() => void submit()}
            disabled={busy || !email.trim() || password.length < 8}
          />
          <Pressable
            onPress={() => {
              setMode(mode === 'signIn' ? 'signUp' : 'signIn');
              setError(null);
            }}
          >
            <Text style={styles.switch}>
              {mode === 'signIn'
                ? 'New here? Create an account'
                : 'Already have an account? Sign in'}
            </Text>
          </Pressable>
          <Pressable onPress={() => void continueOffline()}>
            <Text style={styles.offline}>Use without an account</Text>
          </Pressable>
        </View>

        <Text style={styles.disclaimer}>
          Lumen stores your check-ins on this device first. AI processing stays
          off until you choose to enable it.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: 26, justifyContent: 'center' },
  eyebrow: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 3,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.serif,
    fontSize: 34,
    marginTop: 10,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 28,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#E1DDD5',
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 54,
    marginBottom: 12,
    fontSize: 15,
    color: colors.text,
  },
  error: { color: colors.danger, fontSize: 13, marginBottom: 8 },
  spinner: { marginBottom: 12 },
  actions: { gap: 16, marginTop: 8 },
  switch: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  offline: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  disclaimer: {
    color: colors.textFaint,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 30,
  },
});
