import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../src/auth/AuthContext';
import { API_BASE_URL, describeError } from '../src/api/client';
import { Atmosphere } from '../src/components/Atmosphere';
import { HeroCurve } from '../src/components/HeroCurve';
import { PressableButton } from '../src/components/PressableButton';
import { Body, Caption, Display, Overline } from '../src/components/Type';
import { color, font, radius, space } from '../src/theme/tokens';
import { errorFeedback, successFeedback } from '../src/lib/haptics';

/**
 * Sign-in. Structure follows Oportun's login screen — title, one labelled
 * field, primary action pinned low — with the Face ID branch modelled on Dave's
 * unlock prompt.
 *
 * The password is the server's `APP_PASSWORD`, checked by the user's own backend.
 * No SnapTrade or brokerage credential is ever entered or held here.
 */
export default function LoginScreen() {
  const { phase, signIn, unlock, biometricEnabled } = useAuth();
  const insets = useSafeAreaInsets();
  const [secret, setSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassphraseForm, setShowPassphraseForm] = useState(false);

  const locked = phase === 'locked';

  useEffect(() => {
    // Offer the biometric sheet immediately on a locked launch, the way banking
    // apps do, rather than making the user tap first.
    if (locked && biometricEnabled && !showPassphraseForm) {
      void unlock();
    }
  }, [locked, biometricEnabled, showPassphraseForm, unlock]);

  if (phase === 'signedIn') return <Redirect href="/(tabs)" />;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn(secret);
      successFeedback();
      setSecret('');
    } catch (caught) {
      errorFeedback();
      setError(describeError(caught));
    } finally {
      setBusy(false);
    }
  };

  const host = API_BASE_URL
    ? API_BASE_URL.replace(/^https?:\/\//, '')
    : 'not configured';

  return (
    <View style={styles.root}>
      <Atmosphere />
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + space['5xl'], paddingBottom: insets.bottom + space['3xl'] },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brand}>
            <Overline>Meridian</Overline>
            <Display style={styles.headline}>
              {locked && !showPassphraseForm ? 'Welcome back' : 'Your whole portfolio'}
            </Display>
            <Body style={styles.subhead}>
              Crypto, brokerages and manual accounts in one read-only view.
            </Body>
            <HeroCurve up bleed={space['2xl']} />
          </View>

          {locked && !showPassphraseForm ? (
            <View style={styles.form}>
              <PressableButton
                label="Unlock with Face ID"
                onPress={() => void unlock()}
                fullWidth
              />
              <PressableButton
                label="Use password instead"
                variant="quiet"
                onPress={() => setShowPassphraseForm(true)}
                fullWidth
              />
            </View>
          ) : (
            <View style={styles.form}>
              <View>
                <Overline style={styles.fieldLabel}>Meridian password</Overline>
                <TextInput
                  style={styles.input}
                  value={secret}
                  onChangeText={(next) => {
                    setSecret(next);
                    if (error) setError(null);
                  }}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="password"
                  textContentType="password"
                  returnKeyType="go"
                  onSubmitEditing={() => void submit()}
                  editable={!busy}
                  accessibilityLabel="Meridian password"
                />
              </View>

              {error ? (
                <View style={styles.error} accessibilityRole="alert">
                  <Ionicons name="alert-circle" size={16} color={color.loss} />
                  <Caption style={styles.errorText}>{error}</Caption>
                </View>
              ) : null}

              <PressableButton
                label="Sign in"
                onPress={() => void submit()}
                loading={busy}
                disabled={secret.trim().length === 0}
                fullWidth
              />

              {locked ? (
                <Pressable
                  onPress={() => setShowPassphraseForm(false)}
                  style={styles.linkRow}
                >
                  <Caption style={styles.link}>Use Face ID instead</Caption>
                </Pressable>
              ) : null}
            </View>
          )}

          <View style={styles.footer}>
            <View style={styles.footerRow}>
              <Ionicons name="lock-closed" size={13} color={color.mutedForeground} />
              <Caption style={styles.footerText}>{host}</Caption>
            </View>
            <Caption style={styles.footerNote}>
              Read-only. Your session is stored in the iOS Keychain, and brokerage
              keys never leave your server.
            </Caption>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: space['2xl'],
    gap: space['4xl'],
  },
  brand: { gap: space.sm },
  headline: { fontSize: 38, lineHeight: 42, letterSpacing: -1.2, marginTop: space.xs },
  subhead: { color: color.mutedForeground, maxWidth: 300 },
  form: { gap: space.lg },
  fieldLabel: { marginBottom: space.sm },
  input: {
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: 15,
    fontFamily: font.body,
    fontSize: 17,
    color: color.foreground,
    minHeight: 52,
  },
  error: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  errorText: { color: color.loss, flex: 1 },
  linkRow: { alignItems: 'center', paddingVertical: space.xs },
  link: { color: color.primary, fontSize: 14 },
  // Pinned to the bottom of the scroll frame regardless of content height.
  footer: { gap: space.xs, marginTop: 'auto' },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerText: { fontFamily: font.mono, fontSize: 12 },
  footerNote: { fontSize: 12, opacity: 0.85 },
});
