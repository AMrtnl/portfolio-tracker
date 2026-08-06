import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { atmosphere, color } from '../theme/tokens';

/**
 * The Meridian backdrop. The web app layers three radial blooms over a linear
 * wash; expo-linear-gradient has no radial mode, so the same stop colours are
 * rebuilt as overlapping directional gradients pinned behind the content.
 *
 * `pointerEvents="none"` keeps the whole stack non-interactive.
 */
export function Atmosphere() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={[...atmosphere.wash]}
        locations={[0, 0.48, 1]}
        start={{ x: 0.15, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Teal bloom, top-left */}
      <LinearGradient
        colors={[...atmosphere.teal]}
        locations={[0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.85, y: 0.9 }}
        style={styles.topLeft}
      />
      {/* Sky bloom, top-right */}
      <LinearGradient
        colors={[...atmosphere.sky]}
        locations={[0, 0.4, 1]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0.05, y: 1 }}
        style={styles.topRight}
      />
      {/* Sage bloom lifting the lower third */}
      <LinearGradient
        colors={[...atmosphere.sage]}
        locations={[0, 0.55, 1]}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.85, y: 1 }}
        style={styles.bottom}
      />
    </View>
  );
}

/** Flat backdrop for sheets and detail screens that sit above the atmosphere. */
export function SolidBackdrop() {
  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: color.background }]}
      pointerEvents="none"
    />
  );
}

// Blooms overhang the viewport so the gradient reaches zero alpha off-screen
// rather than terminating at a visible view edge.
const styles = StyleSheet.create({
  topLeft: { position: 'absolute', top: -160, left: -160, right: -40, height: 620 },
  topRight: { position: 'absolute', top: -140, right: -160, left: 0, height: 520 },
  bottom: { position: 'absolute', bottom: -80, left: -60, right: -60, height: 460 },
});
