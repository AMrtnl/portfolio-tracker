import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Haptics are reserved for moments where the user caused something that isn't
 * otherwise obvious: pulling to refresh, landing on fresh data, hitting an
 * error, or opening a row. Navigation already has its own system feedback.
 */

const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

export function tapFeedback() {
  if (!enabled) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function selectionFeedback() {
  if (!enabled) return;
  void Haptics.selectionAsync();
}

export function successFeedback() {
  if (!enabled) return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

export function warningFeedback() {
  if (!enabled) return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}

export function errorFeedback() {
  if (!enabled) return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}
