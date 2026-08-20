import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { color, radius, space } from '../theme/tokens';
import { Caption, Overline, Title } from './Type';
import { selectionFeedback } from '../lib/haptics';

/**
 * Section scaffold. The web app opens each block with an uppercase micro-label
 * over a hairline rule instead of boxing everything in cards, which keeps the
 * hero the only visually heavy element.
 */
export function Section({
  overline,
  title,
  caption,
  action,
  children,
  style,
}: {
  overline?: string;
  title?: string;
  caption?: string;
  action?: { label: string; onPress: () => void };
  children: ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.section, style]}>
      {overline || title || action ? (
        <View style={styles.header}>
          <View style={styles.headerText}>
            {overline ? <Overline>{overline}</Overline> : null}
            {title ? <Title style={styles.title}>{title}</Title> : null}
            {caption ? <Caption>{caption}</Caption> : null}
          </View>
          {action ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                selectionFeedback();
                action.onPress();
              }}
              hitSlop={8}
              style={({ pressed }) => [styles.action, pressed && styles.pressed]}
            >
              <Caption style={styles.actionLabel}>{action.label}</Caption>
              <Ionicons name="chevron-forward" size={13} color={color.primary} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/** Hairline-separated list container, replacing the web's divide-y lists. */
export function ListGroup({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.group, style]}>{children}</View>;
}

/** Translucent panel for the few places that genuinely need a raised surface. */
export function Panel({
  children,
  style,
}: {
  children: ReactNode;
  style?: ViewStyle;
}) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space.md,
  },
  headerText: { flex: 1, gap: 4 },
  title: { marginTop: 2 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  actionLabel: { color: color.primary, fontSize: 14 },
  pressed: { opacity: 0.6 },
  group: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  panel: {
    backgroundColor: color.surface,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    padding: space.lg,
  },
});
