import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Atmosphere } from './Atmosphere';
import { color, space } from '../theme/tokens';

/** Height of the translucent tab bar that content scrolls beneath. */
const TAB_BAR_CLEARANCE = 58;
/** Native stack header sitting over tab screens. */
const HEADER_CLEARANCE = 44;

interface Props {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Detail screens sit on a flat background instead of the atmosphere. */
  plain?: boolean;
  /** Set when the screen is pushed rather than a tab, so no tab-bar clearance. */
  insideTabs?: boolean;
  /** Extra top padding for screens with a transparent native header. */
  headerOffset?: number;
}

/**
 * Scroll container shared by every screen: safe-area aware, atmosphere behind,
 * and pull-to-refresh tinted to the brand.
 */
export function ScreenScroll({
  children,
  refreshing = false,
  onRefresh,
  plain = false,
  insideTabs = true,
  headerOffset = 0,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      {plain ? null : <Atmosphere />}
      <ScrollView
        style={styles.root}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + headerOffset + space.lg + (insideTabs ? HEADER_CLEARANCE : 0),
            paddingBottom:
              insets.bottom + space['3xl'] + (insideTabs ? TAB_BAR_CLEARANCE : 0),
          },
        ]}
        // iOS momentum indicators feel wrong over a light wash without this.
        indicatorStyle="white"
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={color.primary}
              colors={[color.primary]}
              progressViewOffset={insets.top}
            />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </View>
  );
}

/** Non-scrolling variant for full-screen loading and error states. */
export function ScreenFill({
  children,
  plain = false,
}: {
  children: ReactNode;
  plain?: boolean;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      {plain ? null : <Atmosphere />}
      <View
        style={[
          styles.fill,
          { paddingTop: insets.top + HEADER_CLEARANCE, paddingBottom: insets.bottom + TAB_BAR_CLEARANCE },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: space['2xl'], gap: space['3xl'] },
  fill: { flex: 1 },
});
