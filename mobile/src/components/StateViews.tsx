import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { color, radius, space } from '../theme/tokens';
import { Body, Caption, Overline, Title } from './Type';
import { PressableButton } from './PressableButton';

/** Full-screen loading state used while a screen has nothing to show yet. */
export function LoadingState({ label = 'Syncing balances…' }: { label?: string }) {
  return (
    <View style={styles.centered} accessibilityRole="progressbar">
      <ActivityIndicator color={color.primary} />
      <Caption style={styles.centeredText}>{label}</Caption>
    </View>
  );
}

export function ErrorState({
  title = 'Couldn’t load',
  message,
  onRetry,
  hint,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  hint?: string;
}) {
  return (
    <View style={styles.centered}>
      <View style={styles.errorIcon}>
        <Ionicons name="cloud-offline-outline" size={22} color={color.loss} />
      </View>
      <Title style={styles.centeredTitle}>{title}</Title>
      <Body style={styles.centeredText}>{message}</Body>
      {hint ? <Caption style={styles.hint}>{hint}</Caption> : null}
      {onRetry ? (
        <PressableButton label="Try again" onPress={onRetry} style={styles.action} />
      ) : null}
    </View>
  );
}

export function EmptyState({
  icon = 'file-tray-outline',
  title,
  message,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
}) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={20} color={color.mutedForeground} />
      <Body style={styles.emptyTitle}>{title}</Body>
      <Caption style={styles.emptyMessage}>{message}</Caption>
    </View>
  );
}

/**
 * Partial-failure banner. The aggregate endpoint returns data *and* errors when
 * one source fails, so both are shown instead of replacing the screen.
 */
export function WarningBanner({
  title,
  lines,
}: {
  title: string;
  lines: string[];
}) {
  if (lines.length === 0) return null;
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Ionicons
        name="alert-circle-outline"
        size={16}
        color={color.warn}
        style={styles.bannerIcon}
      />
      <View style={styles.bannerBody}>
        <Overline style={styles.bannerTitle}>{title}</Overline>
        {lines.map((line) => (
          <Caption key={line} style={styles.bannerLine}>
            {line}
          </Caption>
        ))}
      </View>
    </View>
  );
}

/** Shown when EXPO_PUBLIC_API_URL was never configured. */
export function ConfigurationNotice() {
  return (
    <View style={styles.centered}>
      <Title style={styles.centeredTitle}>API URL missing</Title>
      <Body style={styles.centeredText}>
        Set EXPO_PUBLIC_API_URL to your Railway deployment, then restart the dev
        server.
      </Body>
      <Caption style={styles.hint}>
        Meridian never talks to a brokerage directly — only to your own backend.
      </Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space['3xl'],
    gap: space.md,
  },
  centeredTitle: { textAlign: 'center' },
  centeredText: { textAlign: 'center', color: color.mutedForeground },
  hint: { textAlign: 'center', opacity: 0.8 },
  action: { marginTop: space.sm },
  errorIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.lossSoft,
  },
  empty: {
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space['3xl'],
    paddingHorizontal: space.xl,
  },
  emptyTitle: { color: color.foreground },
  emptyMessage: { textAlign: 'center', maxWidth: 280 },
  banner: {
    flexDirection: 'row',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: color.warnSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(208, 157, 37, 0.35)',
  },
  bannerIcon: { marginTop: 2 },
  bannerBody: { flex: 1, gap: 3 },
  bannerTitle: { color: '#8A6714' },
  bannerLine: { color: '#7A5C13' },
});
