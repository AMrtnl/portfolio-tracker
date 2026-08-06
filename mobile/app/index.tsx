import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../src/auth/AuthContext';
import { Atmosphere } from '../src/components/Atmosphere';
import { color } from '../src/theme/tokens';

/**
 * Entry gate. Keychain reads are async, so this holds a neutral screen until the
 * session phase is known — without it the login screen flashes on every launch.
 */
export default function Index() {
  const { phase } = useAuth();

  if (phase === 'restoring') {
    return (
      <View style={styles.container}>
        <Atmosphere />
        <ActivityIndicator color={color.primary} />
      </View>
    );
  }

  // A locked session still routes to /login, which renders the biometric unlock
  // prompt instead of the passphrase form.
  if (phase === 'signedIn') return <Redirect href="/(tabs)" />;
  return <Redirect href="/login" />;
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
