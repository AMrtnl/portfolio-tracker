import { useCallback } from 'react';
import { Alert, Linking, StyleSheet, Switch, View } from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth/AuthContext';
import { useSnapStatus } from '../../src/api/queries';
import { API_BASE_URL } from '../../src/api/client';
import { ListRow } from '../../src/components/ListRow';
import { PressableButton } from '../../src/components/PressableButton';
import { StatusPill } from '../../src/components/Pills';
import { ListGroup, Panel, Section } from '../../src/components/Section';
import { ScreenScroll } from '../../src/components/ScreenScroll';
import { Body, Caption, Display, Mono } from '../../src/components/Type';
import { relativeTime } from '../../src/lib/format';
import { color, space } from '../../src/theme/tokens';

const SNAPTRADE_DOCS = 'https://docs.snaptrade.com/docs/build-with-ai.md';

/**
 * Settings, session and the security disclosure. Nothing here mutates portfolio
 * data — account management lives in the web app.
 */
export default function SettingsScreen() {
  const {
    signOut,
    biometricEnabled,
    biometricAvailable,
    setBiometricEnabled,
  } = useAuth();
  const snapStatusQuery = useSnapStatus();

  const confirmSignOut = useCallback(() => {
    Alert.alert(
      'Sign out?',
      'Your session will be revoked on the server and removed from this device’s Keychain.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: () => void signOut(),
        },
      ],
    );
  }, [signOut]);

  const snap = snapStatusQuery.data;
  const host = API_BASE_URL
    ? API_BASE_URL.replace(/^https?:\/\//, '')
    : 'not configured';

  return (
    <ScreenScroll>
      <Display>Settings</Display>

      <Section overline="Security">
        <ListGroup>
          <ListRow
            title="Unlock with Face ID"
            subtitle={
              biometricAvailable
                ? 'Require biometrics each time the app opens'
                : 'No enrolled biometrics on this device'
            }
            trailing={
              <Switch
                value={biometricEnabled}
                disabled={!biometricAvailable}
                onValueChange={(next) => void setBiometricEnabled(next)}
                trackColor={{ true: color.primary, false: color.border }}
              />
            }
          />
          <ListRow
            title="Session storage"
            subtitle="iOS Keychain, this device only"
            trailing={<StatusPill label="Encrypted" tone="ok" />}
          />
        </ListGroup>
      </Section>

      <Section overline="Backend" caption="Meridian only talks to your own server.">
        <ListGroup>
          <ListRow title="API host" trailing={<Mono style={styles.host}>{host}</Mono>} />
          <ListRow
            title="Brokerage sync"
            subtitle={
              snap?.configured
                ? `${snap.accountCount} account${
                    snap.accountCount === 1 ? '' : 's'
                  } · ${snap.connectionCount} connection${
                    snap.connectionCount === 1 ? '' : 's'
                  }`
                : 'No SnapTrade key on the server'
            }
            trailing={
              <StatusPill
                label={snap?.configured ? 'Configured' : 'Off'}
                tone={
                  snap?.configured
                    ? snap.disabledConnectionCount > 0
                      ? 'warn'
                      : 'ok'
                    : 'neutral'
                }
              />
            }
          />
          {snap?.retrievedAt ? (
            <ListRow
              title="Last checked"
              trailing={<Caption>{relativeTime(snap.retrievedAt)}</Caption>}
            />
          ) : null}
        </ListGroup>
      </Section>

      <Section overline="How this app handles credentials">
        <Panel>
          <View style={styles.disclosure}>
            <Ionicons name="shield-checkmark-outline" size={20} color={color.primary} />
            <View style={styles.disclosureBody}>
              <Body>No brokerage keys on this device</Body>
              <Caption>
                SnapTrade’s Personal API key identifies you as the account holder
                and must never ship inside a distributed app. It stays in your
                server’s environment; this app only receives read-only,
                already-normalized values.
              </Caption>
              <Caption style={styles.link} onPress={() => void Linking.openURL(SNAPTRADE_DOCS)}>
                SnapTrade distribution guidance ↗
              </Caption>
            </View>
          </View>
        </Panel>
        <Caption>
          Read-only by design: Meridian exposes no order placement, no transfers
          and no account edits.
        </Caption>
      </Section>

      <Section overline="Session">
        <PressableButton
          label="Sign out"
          variant="secondary"
          onPress={confirmSignOut}
          fullWidth
        />
      </Section>

      <Caption style={styles.version}>
        Meridian {Constants.expoConfig?.version ?? '1.0.0'}
        {Constants.expoConfig?.ios?.buildNumber
          ? ` (${Constants.expoConfig.ios.buildNumber})`
          : ''}
      </Caption>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  host: { fontSize: 12 },
  disclosure: { flexDirection: 'row', gap: space.md },
  disclosureBody: { flex: 1, gap: space.xs },
  link: { color: color.primary },
  version: { textAlign: 'center', opacity: 0.7 },
});
