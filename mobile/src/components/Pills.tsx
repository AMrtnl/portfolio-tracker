import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { color, font, radius, space } from '../theme/tokens';
import { formatPercent } from '../lib/format';
import { Caption, Mono } from './Type';
import type { AccountStatus, ProviderId } from '../api/types';

/** Signed percentage in a tinted capsule — the Stake / Yahoo Finance day-change cue. */
export function DeltaPill({
  value,
  style,
}: {
  value: number;
  style?: ViewStyle;
}) {
  const positive = value >= 0;
  return (
    <View
      style={[
        styles.delta,
        { backgroundColor: positive ? color.gainSoft : color.lossSoft },
        style,
      ]}
    >
      <Mono style={[styles.deltaText, { color: positive ? color.gain : color.loss }]}>
        {formatPercent(value)}
      </Mono>
    </View>
  );
}

type Tone = 'ok' | 'warn' | 'bad' | 'neutral';

const TONE: Record<Tone, { fg: string; bg: string; dot: string }> = {
  ok: { fg: color.gain, bg: color.gainSoft, dot: color.gain },
  warn: { fg: color.warn, bg: color.warnSoft, dot: color.warn },
  bad: { fg: color.loss, bg: color.lossSoft, dot: color.loss },
  neutral: {
    fg: color.mutedForeground,
    bg: color.muted,
    dot: color.mutedForeground,
  },
};

export function StatusPill({
  label,
  tone,
  style,
}: {
  label: string;
  tone: Tone;
  style?: ViewStyle;
}) {
  const palette = TONE[tone];
  return (
    <View style={[styles.status, { backgroundColor: palette.bg }, style]}>
      <View style={[styles.dot, { backgroundColor: palette.dot }]} />
      <Caption style={[styles.statusText, { color: palette.fg }]}>{label}</Caption>
    </View>
  );
}

/** Maps API account status onto copy plus a tone. */
export function accountStatusPill(
  status: AccountStatus,
  hasError: boolean,
): { label: string; tone: Tone } {
  switch (status) {
    case 'connected':
      return hasError
        ? { label: 'Partial data', tone: 'warn' }
        : { label: 'Connected', tone: 'ok' };
    case 'pending':
      return { label: 'Pending', tone: 'warn' };
    case 'error':
      return { label: 'Needs attention', tone: 'bad' };
    case 'disconnected':
      return { label: 'Disconnected', tone: 'bad' };
    case 'unconfigured':
      return { label: 'Not configured', tone: 'neutral' };
    default:
      return { label: status, tone: 'neutral' };
  }
}

const PROVIDER_ICON: Record<ProviderId, keyof typeof Ionicons.glyphMap> = {
  snaptrade: 'business-outline',
  hyperliquid: 'link-outline',
  manual: 'create-outline',
};

const PROVIDER_LABEL: Record<ProviderId, string> = {
  snaptrade: 'Brokerage',
  hyperliquid: 'Crypto wallet',
  manual: 'Manual',
};

export function providerLabel(provider: ProviderId): string {
  return PROVIDER_LABEL[provider] ?? provider;
}

/** Square glyph tile standing in for a brokerage logo (Wealthfront pattern). */
export function ProviderGlyph({ provider }: { provider: ProviderId }) {
  return (
    <View style={styles.glyph}>
      <Ionicons
        name={PROVIDER_ICON[provider] ?? 'ellipse-outline'}
        size={17}
        color={color.primary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  delta: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  deltaText: { fontFamily: font.monoMedium, fontSize: 13 },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  statusText: { fontFamily: font.bodyMedium, fontSize: 12 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  glyph: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.accent,
    marginRight: space.md,
  },
});
