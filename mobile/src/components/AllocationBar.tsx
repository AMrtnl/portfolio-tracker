import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { chartColor, color, radius, space } from '../theme/tokens';
import { formatMoney, formatWeight } from '../lib/format';
import { Body, Caption, Mono } from './Type';

export interface AllocationSlice {
  label: string;
  value: number;
  sublabel?: string;
}

interface Props {
  slices: AllocationSlice[];
  currency: string;
  maxRows?: number;
}

/**
 * Stacked composition bar plus legend, mirroring the web AllocationBar.
 * Reference: Copilot Money's allocation block and Origin's portfolio breakdown.
 */
export function AllocationBar({ slices, currency, maxRows = 6 }: Props) {
  const total = slices.reduce((sum, slice) => sum + Math.max(slice.value, 0), 0);

  if (total <= 0 || slices.length === 0) {
    return (
      <View style={styles.wrapper}>
        <View style={styles.emptyTrack} />
        <Caption>Allocation appears once holdings report a value.</Caption>
      </View>
    );
  }

  const sorted = [...slices]
    .filter((slice) => slice.value > 0)
    .sort((a, b) => b.value - a.value);
  const visible = sorted.slice(0, maxRows);
  const remainder = sorted.slice(maxRows);
  const remainderValue = remainder.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <View style={styles.wrapper}>
      <GrowingTrack
        segments={sorted.map((slice, index) => ({
          key: slice.label,
          weight: (slice.value / total) * 100,
          tint: chartColor(index),
        }))}
      />

      <View style={styles.legend}>
        {visible.map((slice, index) => (
          <View key={slice.label} style={styles.legendRow}>
            <View style={styles.legendLeft}>
              <View style={[styles.swatch, { backgroundColor: chartColor(index) }]} />
              <View style={styles.legendText}>
                <Body numberOfLines={1}>{slice.label}</Body>
                <Caption numberOfLines={1}>
                  {slice.sublabel
                    ? `${formatWeight((slice.value / total) * 100)} · ${slice.sublabel}`
                    : formatWeight((slice.value / total) * 100)}
                </Caption>
              </View>
            </View>
            <Mono>{formatMoney(slice.value, currency, { compact: true })}</Mono>
          </View>
        ))}

        {remainder.length > 0 ? (
          <View style={styles.legendRow}>
            <View style={styles.legendLeft}>
              <View style={[styles.swatch, styles.swatchMuted]} />
              <View style={styles.legendText}>
                <Body>{`${remainder.length} more`}</Body>
                <Caption>{formatWeight((remainderValue / total) * 100)}</Caption>
              </View>
            </View>
            <Mono>{formatMoney(remainderValue, currency, { compact: true })}</Mono>
          </View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * Motion 2 of 3 — segments wipe outward from the leading edge in sequence, so
 * the composition reads left to right the first time it appears.
 */
function GrowingTrack({
  segments,
}: {
  segments: { key: string; weight: number; tint: string }[];
}) {
  return (
    <View style={styles.track} accessibilityRole="image">
      {segments.map((segment, index) =>
        segment.weight < 0.4 ? null : (
          <Segment
            key={segment.key}
            weight={segment.weight}
            tint={segment.tint}
            delay={index * 70}
          />
        ),
      )}
    </View>
  );
}

function Segment({
  weight,
  tint,
  delay,
}: {
  weight: number;
  tint: string;
  delay: number;
}) {
  const grow = useSharedValue(0);

  useEffect(() => {
    grow.value = withDelay(
      delay,
      withTiming(1, { duration: 620, easing: Easing.bezier(0.22, 1, 0.36, 1) }),
    );
  }, [delay, grow]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: grow.value }],
    opacity: 0.4 + grow.value * 0.6,
  }));

  return (
    <Animated.View
      style={[
        styles.segment,
        { flexGrow: weight, backgroundColor: tint },
        animatedStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: space.lg },
  track: {
    flexDirection: 'row',
    height: 10,
    borderRadius: radius.sm,
    overflow: 'hidden',
    backgroundColor: color.muted,
  },
  emptyTrack: {
    height: 10,
    borderRadius: radius.sm,
    backgroundColor: color.muted,
  },
  segment: { flexBasis: 0, height: '100%', transformOrigin: 'left' },
  legend: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  legendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    flex: 1,
    minWidth: 0,
  },
  legendText: { flex: 1, minWidth: 0 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  swatchMuted: { backgroundColor: color.border },
});
