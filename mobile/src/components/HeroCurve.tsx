import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { color, space } from '../theme/tokens';

const UP = 'M0 52 C40 48 70 44 110 36 C150 28 180 22 220 18 C260 14 300 20 340 12';
const DOWN =
  'M0 18 C40 22 70 28 110 34 C150 40 180 46 220 44 C260 42 300 50 340 54';

/**
 * Decorative sentiment curve, carried over verbatim from the web hero. It is
 * atmosphere, not history — the API exposes no balance time series, so drawing a
 * real chart here would be inventing data.
 *
 * Motion 3 of 3: the curve wipes in from the left on mount.
 */
export function HeroCurve({
  up,
  /**
   * Runs the drawing edge-to-edge past the screen's content padding. Without it
   * the gradient fill terminates at the padding and reads as a rectangle, and a
   * full-bleed chart is the convention anyway (Revolut, Acorns, Public).
   */
  bleed = 0,
}: {
  up: boolean;
  bleed?: number;
}) {
  const reveal = useSharedValue(0);
  // The drawing keeps its own width while the mask grows, otherwise the curve
  // would stretch instead of being revealed.
  const [frameWidth, setFrameWidth] = useState(0);

  useEffect(() => {
    reveal.value = 0;
    reveal.value = withTiming(1, {
      duration: 1100,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
    });
  }, [up, reveal]);

  const maskStyle = useAnimatedStyle(() => ({
    // The extra pixel keeps sub-pixel rounding from leaving a seam at the
    // trailing edge once the wipe completes.
    width: frameWidth * reveal.value + 1,
    opacity: 0.35 + reveal.value * 0.65,
  }));

  const tint = up ? color.primary : color.loss;

  return (
    <View
      style={[styles.frame, { marginHorizontal: -bleed }]}
      accessible={false}
      pointerEvents="none"
      onLayout={(event) => setFrameWidth(event.nativeEvent.layout.width)}
    >
      <Animated.View style={[styles.mask, maskStyle]}>
        <Svg
          width={frameWidth}
          height={56}
          viewBox="0 0 340 64"
          preserveAspectRatio="none"
        >
          <Defs>
            <LinearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={tint} stopOpacity={0.22} />
              <Stop offset="1" stopColor={tint} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Path
            d={`${up ? UP : DOWN} L340 64 L0 64 Z`}
            fill="url(#heroFill)"
            stroke="none"
          />
          <Path
            d={up ? UP : DOWN}
            fill="none"
            stroke={tint}
            strokeWidth={2.5}
            strokeLinecap="round"
            opacity={0.75}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { height: 56, marginTop: space.xl, overflow: 'hidden' },
  // A fixed-width child inside a growing mask produces the wipe without
  // stretching the geometry.
  mask: { height: 56, overflow: 'hidden' },
});
