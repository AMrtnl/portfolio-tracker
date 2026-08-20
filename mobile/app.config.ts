import type { ExpoConfig } from 'expo/config';

/**
 * Every value that differs per install is read from the environment so that no
 * account identifier or URL is baked into the repo. See mobile/README.md.
 *
 *   EXPO_PUBLIC_API_URL   – https://<your-app>.up.railway.app
 *   MERIDIAN_BUNDLE_ID    – com.yourname.meridian
 *   EAS_PROJECT_ID        – filled in by `eas init`
 *   APPLE_TEAM_ID         – 10-character Apple Developer team id
 */
const bundleIdentifier =
  process.env.MERIDIAN_BUNDLE_ID ?? 'com.example.meridian';

const config: ExpoConfig = {
  name: 'Meridian',
  slug: 'meridian',
  scheme: 'meridian',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  backgroundColor: '#000000',
  assetBundlePatterns: ['**/*'],
  ios: {
    bundleIdentifier,
    supportsTablet: false,
    // A read-only aggregator has nothing to encrypt beyond HTTPS itself, which
    // keeps the annual self-classification report out of scope.
    config: { usesNonExemptEncryption: false },
    infoPlist: {
      NSFaceIDUsageDescription:
        'Meridian uses Face ID to unlock your saved session so your portfolio stays private.',
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: bundleIdentifier,
    adaptiveIcon: {
      backgroundColor: '#000000',
      foregroundImage: './assets/android-icon-foreground.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: { favicon: './assets/favicon.png' },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-font',
    [
      'expo-local-authentication',
      {
        faceIDPermission:
          'Meridian uses Face ID to unlock your saved session so your portfolio stays private.',
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 180,
        resizeMode: 'contain',
        backgroundColor: '#000000',
      },
    ],
  ],
  experiments: { typedRoutes: true },
  extra: {
    router: {},
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
};

export default config;
