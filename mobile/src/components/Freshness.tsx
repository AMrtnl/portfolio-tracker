import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { color, space } from '../theme/tokens';
import { formatClockTime, relativeTime } from '../lib/format';
import { Caption } from './Type';

/**
 * "Retrieved at" line. Every finance reference app states data age explicitly
 * (Yahoo Finance's "Last refresh …", Fidelity's "As of …"), and it matters more
 * here because brokerage data arrives via overnight aggregation.
 */
export function Freshness({
  retrievedAt,
  isFetching,
  label = 'Updated',
}: {
  retrievedAt: string | null | undefined;
  isFetching?: boolean;
  label?: string;
}) {
  const clock = formatClockTime(retrievedAt);
  return (
    <View style={styles.row}>
      {isFetching ? (
        <ActivityIndicator size="small" color={color.mutedForeground} />
      ) : null}
      <Caption style={styles.text}>
        {isFetching
          ? 'Refreshing…'
          : `${label} ${relativeTime(retrievedAt)}${clock ? ` · ${clock}` : ''}`}
      </Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  text: { fontSize: 12 },
});
