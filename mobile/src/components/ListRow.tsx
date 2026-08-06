import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { color, space } from '../theme/tokens';
import { Body, Caption } from './Type';
import { selectionFeedback } from '../lib/haptics';

interface Props {
  title: string;
  subtitle?: string;
  /** Right-aligned value column, usually a Mono figure plus a delta. */
  trailing?: ReactNode;
  leading?: ReactNode;
  onPress?: () => void;
  /** Renders the disclosure chevron; implied by onPress. */
  showChevron?: boolean;
  /** Error line rendered under the subtitle in the loss colour. */
  errorText?: string;
}

/**
 * Single hairline-separated row. Follows the Fidelity / Wealthsimple pattern of
 * symbol + quantity on the left and value + change stacked on the right.
 */
export function ListRow({
  title,
  subtitle,
  trailing,
  leading,
  onPress,
  showChevron,
  errorText,
}: Props) {
  const chevron = showChevron ?? Boolean(onPress);

  const content = (
    <View style={styles.row}>
      {leading}
      <View style={styles.text}>
        <Body numberOfLines={1}>{title}</Body>
        {subtitle ? <Caption numberOfLines={1}>{subtitle}</Caption> : null}
        {errorText ? (
          <Caption numberOfLines={2} style={styles.error}>
            {errorText}
          </Caption>
        ) : null}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      {chevron ? (
        <Ionicons
          name="chevron-forward"
          size={16}
          color={color.mutedForeground}
          style={styles.chevron}
        />
      ) : null}
    </View>
  );

  if (!onPress) return <View style={styles.container}>{content}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        selectionFeedback();
        onPress();
      }}
      style={({ pressed }) => [styles.container, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  pressed: { backgroundColor: 'rgba(224, 235, 232, 0.55)' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    gap: space.md,
    minHeight: 56,
  },
  text: { flex: 1, minWidth: 0, gap: 1 },
  trailing: { alignItems: 'flex-end', gap: 2 },
  chevron: { marginLeft: -4 },
  error: { color: color.loss },
});
