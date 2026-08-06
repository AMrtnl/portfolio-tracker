import { useEffect, useState } from 'react';
import { StyleSheet, Text, type TextStyle } from 'react-native';
import {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { color, font } from '../theme/tokens';
import { formatMoney } from '../lib/format';

interface Props {
  value: number;
  currency: string;
  style?: TextStyle | TextStyle[];
}

/**
 * Motion 1 of 3 — the portfolio total counts up on first paint and eases to each
 * new value after a refresh, so a change is felt rather than just noticed.
 *
 * The timing runs on the UI thread; text can't be interpolated natively, so the
 * value is sampled back to JS. Sampling at cent precision on a six-figure total
 * would re-render every frame for no visible gain, so the step scales with
 * magnitude and the exact figure is snapped in once the animation settles.
 */
export function AnimatedMoney({ value, currency, style }: Props) {
  const progress = useSharedValue(0);
  const [display, setDisplay] = useState(0);
  const [settled, setSettled] = useState(false);

  const step = Math.abs(value) >= 1000 ? 1 : 0.01;

  useEffect(() => {
    setSettled(false);
    progress.value = withTiming(
      value,
      { duration: 900, easing: Easing.bezier(0.22, 1, 0.36, 1) },
      (finished) => {
        if (finished) runOnJS(setSettled)(true);
      },
    );
  }, [value, progress]);

  useAnimatedReaction(
    () => Math.round(progress.value / step) * step,
    (current, previous) => {
      if (current !== previous) runOnJS(setDisplay)(current);
    },
    [step],
  );

  return (
    <Text
      style={[styles.total, style]}
      accessibilityLiveRegion="polite"
      // Screen readers should hear the settled figure, not every tick.
      accessibilityLabel={`Total value ${formatMoney(value, currency)}`}
    >
      {formatMoney(settled ? value : display, currency)}
    </Text>
  );
}

const styles = StyleSheet.create({
  total: {
    fontFamily: font.display,
    fontSize: 46,
    lineHeight: 52,
    letterSpacing: -1.6,
    color: color.foreground,
    fontVariant: ['tabular-nums'],
  },
});
