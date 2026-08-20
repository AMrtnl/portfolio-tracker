import { Platform, Pressable, StyleSheet } from 'react-native';
import { Redirect, Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useAuth } from '../../src/auth/AuthContext';
import { usePrivacy } from '../../src/wealth/PrivacyContext';
import { color, font } from '../../src/theme/tokens';

export default function TabsLayout() {
  const { phase } = useAuth();
  const { hidden, toggle } = usePrivacy();
  const router = useRouter();

  if (phase === 'signedOut' || phase === 'locked') return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerTransparent: true,
        headerBlurEffect: 'systemThinMaterialDark',
        headerTintColor: color.foreground,
        headerTitleStyle: {
          fontFamily: font.displaySemi,
          fontSize: 17,
          color: color.foreground,
        },
        headerRight: () => (
          <>
            <Pressable
              onPress={toggle}
              hitSlop={12}
              accessibilityLabel={hidden ? 'Show balances' : 'Hide balances'}
              style={styles.headerBtn}
            >
              <Ionicons
                name={hidden ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={color.foreground}
              />
            </Pressable>
            <Pressable
              onPress={() => router.push('/(tabs)/settings')}
              hitSlop={12}
              accessibilityLabel="Settings"
              style={styles.headerBtn}
            >
              <Ionicons name="settings-outline" size={20} color={color.foreground} />
            </Pressable>
          </>
        ),
        tabBarActiveTintColor: color.primary,
        tabBarInactiveTintColor: color.mutedForeground,
        tabBarLabelStyle: styles.label,
        tabBarStyle: Platform.OS === 'ios' ? styles.iosBar : styles.defaultBar,
        tabBarBackground: () =>
          Platform.OS === 'ios' ? (
            <BlurView tint="dark" intensity={50} style={StyleSheet.absoluteFill} />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Wealth',
          tabBarIcon: ({ color: tint, size }) => (
            <Ionicons name="wallet-outline" size={size} color={tint} />
          ),
        }}
      />
      <Tabs.Screen
        name="cashflow"
        options={{
          title: 'Cash flow',
          tabBarIcon: ({ color: tint, size }) => (
            <Ionicons name="swap-horizontal-outline" size={size} color={tint} />
          ),
        }}
      />
      <Tabs.Screen
        name="subscriptions"
        options={{
          title: 'Subscriptions',
          tabBarIcon: ({ color: tint, size }) => (
            <Ionicons name="calendar-outline" size={size} color={tint} />
          ),
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          title: 'Accounts',
          tabBarIcon: ({ color: tint, size }) => (
            <Ionicons name="layers-outline" size={size} color={tint} />
          ),
        }}
      />
      <Tabs.Screen name="holdings" options={{ href: null, title: 'Holdings' }} />
      <Tabs.Screen name="activity" options={{ href: null, title: 'Activity' }} />
      <Tabs.Screen name="settings" options={{ href: null, title: 'Settings' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: font.bodyMedium, fontSize: 10 },
  headerBtn: { marginRight: 14 },
  iosBar: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderTopColor: color.border,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  defaultBar: {
    backgroundColor: color.surfaceSolid,
    borderTopColor: color.border,
  },
});
