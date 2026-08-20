import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
} from '@expo-google-fonts/bricolage-grotesque';
import {
  SourceSans3_400Regular,
  SourceSans3_500Medium,
  SourceSans3_600SemiBold,
} from '@expo-google-fonts/source-sans-3';
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
} from '@expo-google-fonts/ibm-plex-mono';
import { AuthProvider } from '../src/auth/AuthContext';
import { PrivacyProvider } from '../src/wealth/PrivacyContext';
import { color, font } from '../src/theme/tokens';

void SplashScreen.preventAutoHideAsync();

/**
 * A read-only tracker benefits from cached data on cold start, but stale
 * balances are misleading, so windows are short and every screen shows how old
 * its data is.
 */
function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
    },
  });
}

export default function RootLayout() {
  const [queryClient] = useState(createQueryClient);
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    SourceSans3_400Regular,
    SourceSans3_500Medium,
    SourceSans3_600SemiBold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });

  const ready = fontsLoaded || Boolean(fontError);

  const onReady = useCallback(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  useEffect(() => {
    onReady();
  }, [onReady]);

  // Holding the splash avoids a flash of fallback system type in the hero.
  if (!ready) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <PrivacyProvider>
            <StatusBar style="light" />
            <View style={styles.root}>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: color.background },
                }}
              >
                <Stack.Screen name="index" />
                <Stack.Screen name="login" options={{ animation: 'fade' }} />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen
                  name="account/[id]"
                  options={{
                    headerShown: true,
                    headerTitle: 'Account',
                    headerBackTitle: 'Back',
                    headerTransparent: true,
                    headerBlurEffect: 'systemThinMaterialDark',
                    headerTintColor: color.primary,
                    headerTitleStyle: {
                      fontFamily: font.displaySemi,
                      fontSize: 17,
                      color: color.foreground,
                    },
                  }}
                />
              </Stack>
            </View>
            </PrivacyProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.background },
});
