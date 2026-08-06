import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { color, font, radius, space } from '../theme/tokens';
import { tapFeedback } from '../lib/haptics';

interface Props {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'quiet';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
}

export function PressableButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  fullWidth = false,
}: Props) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        fullWidth && styles.fullWidth,
        // iOS convention: buttons dim and settle rather than change colour.
        pressed && styles.pressed,
        inactive && styles.inactive,
        style,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={variant === 'primary' ? color.primaryForeground : color.primary}
          />
        ) : null}
        <Text
          style={[
            styles.label,
            variant === 'primary' ? styles.labelPrimary : styles.labelAccent,
          ]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: space.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  fullWidth: { alignSelf: 'stretch' },
  primary: { backgroundColor: color.primary },
  secondary: {
    backgroundColor: color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  quiet: { backgroundColor: 'transparent', paddingVertical: space.sm },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  inactive: { opacity: 0.5 },
  content: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  label: { fontFamily: font.bodySemi, fontSize: 16 },
  labelPrimary: { color: color.primaryForeground },
  labelAccent: { color: color.primary },
});
