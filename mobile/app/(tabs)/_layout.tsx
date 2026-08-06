import { Platform, StyleSheet } from 'react-native';
import { Redirect, Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useAuth } from '../../src/auth/AuthContext';
import { color, font } from '../../src/theme/tokens';

/**
 * Four tabs, ordered the way investing apps do it: the portfolio first, then
 * what you own, where it comes from, and what happened. Public and Fidelity both
 * put the portfolio in slot one; Wealthfront and YNAB give accounts their own tab
 * rather than burying them in settings.
 */
export default function TabsLayout() {
  const { phase } = useAuth();

  if (phase === 'signedOut' || phase === 'locked') return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.primary,
        tabBarInactiveTintColor: color.mutedForeground,
        tabBarLabelStyle: styles.label,
        // Translucent bar so the atmosphere shows through as content scrolls under.
        tabBarStyle: Platform.OS === 'ios' ? styles.iosBar : styles.defaultBar,
        tabBarBackground: () =>
          Platform.OS === 'ios' ? (
            <BlurView
              tint="light"
              intensity={70}
              style={StyleSheet.absoluteFill}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Portfolio',
          tabBarIcon: ({ color: tint, size }) => (
            <Ionicons name="trending-up" size={size} color={tint} />
          ),
        }}
      />
      <Tabs.Screen
        name="holdings"
        options={{
          title: 'Holdings',
          tabBarIcon: ({ color: tint, size }) => (
            <Ionicons name="layers-outline" size={size} color={tint} />
          ),
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          title: 'Accounts',
          tabBarIcon: ({ color: tint, size }) => (
            <Ionicons name="wallet-outline" size={size} color={tint} />
          ),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color: tint, size }) => (
            <Ionicons name="time-outline" size={size} color={tint} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color: tint, size }) => (
            <Ionicons name="settings-outline" size={size} color={tint} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: font.bodyMedium, fontSize: 11 },
  iosBar: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderTopColor: color.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  defaultBar: {
    backgroundColor: color.surface,
    borderTopColor: color.border,
  },
});
