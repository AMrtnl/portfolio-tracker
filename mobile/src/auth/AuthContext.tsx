import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { useQueryClient } from '@tanstack/react-query';
import { configureApiAuth } from '../api/client';
import {
  authHeadersFor,
  clearStoredCredential,
  login,
  readBiometricPreference,
  readStoredCredential,
  revokeSession,
  verifyCredential,
  writeBiometricPreference,
  writeStoredCredential,
  type SessionCredential,
} from './session';

type Phase = 'restoring' | 'locked' | 'signedOut' | 'signedIn';

interface AuthValue {
  phase: Phase;
  isSignedIn: boolean;
  biometricEnabled: boolean;
  biometricAvailable: boolean;
  signIn: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  unlock: () => Promise<boolean>;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>('restoring');
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  // A ref keeps the credential out of React state so it never lands in a
  // devtools snapshot or a re-render payload.
  const credentialRef = useRef<SessionCredential | null>(null);

  const forgetSession = useCallback(async () => {
    credentialRef.current = null;
    await clearStoredCredential();
    queryClient.clear();
    setPhase('signedOut');
  }, [queryClient]);

  useEffect(() => {
    configureApiAuth({
      getAuthHeaders: () => authHeadersFor(credentialRef.current),
      onUnauthorized: () => {
        void forgetSession();
      },
    });
  }, [forgetSession]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [credential, prefersBiometric, hasHardware, isEnrolled] =
        await Promise.all([
          readStoredCredential(),
          readBiometricPreference(),
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
        ]);
      if (cancelled) return;

      const canUseBiometrics = hasHardware && isEnrolled;
      setBiometricAvailable(canUseBiometrics);
      setBiometricEnabledState(prefersBiometric && canUseBiometrics);

      if (!credential) {
        setPhase('signedOut');
        return;
      }

      // Sessions expire after seven days server-side, so a stored credential is
      // checked before the user is dropped into a screen that would 401.
      let stillValid = false;
      try {
        stillValid = await verifyCredential(credential);
      } catch {
        // Offline: keep the session and let individual screens show their own
        // network errors rather than forcing a re-login with no connectivity.
        stillValid = true;
      }
      if (cancelled) return;

      if (!stillValid) {
        await clearStoredCredential();
        setPhase('signedOut');
        return;
      }

      credentialRef.current = credential;
      setPhase(prefersBiometric && canUseBiometrics ? 'locked' : 'signedIn');
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (password: string) => {
    const trimmed = password.trim();
    if (!trimmed) throw new Error('Enter your Meridian password.');
    const credential = await login(trimmed);
    await writeStoredCredential(credential);
    credentialRef.current = credential;
    setPhase('signedIn');
  }, []);

  const signOut = useCallback(async () => {
    // Revoking first lets the server's Max-Age=0 response also clear iOS's own
    // cookie store, which matters for the 'native' credential kind.
    await revokeSession(credentialRef.current);
    await forgetSession();
  }, [forgetSession]);

  const unlock = useCallback(async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock Meridian',
      fallbackLabel: 'Use password',
      cancelLabel: 'Cancel',
    });
    if (result.success) {
      setPhase('signedIn');
      return true;
    }
    return false;
  }, []);

  const setBiometricEnabled = useCallback(async (enabled: boolean) => {
    if (enabled) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Enable biometric unlock',
      });
      if (!result.success) return;
    }
    await writeBiometricPreference(enabled);
    setBiometricEnabledState(enabled);
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      phase,
      isSignedIn: phase === 'signedIn',
      biometricEnabled,
      biometricAvailable,
      signIn,
      signOut,
      unlock,
      setBiometricEnabled,
    }),
    [
      phase,
      biometricEnabled,
      biometricAvailable,
      signIn,
      signOut,
      unlock,
      setBiometricEnabled,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>.');
  return value;
}
