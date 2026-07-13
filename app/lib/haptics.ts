import * as Haptics from 'expo-haptics';

// The "match" moment (11-UI-DESIGN.md's signature beat) — fired from every
// place a match is first detected: passenger's waiting screen, the driver's
// accept, and autopool's grouping. One place so the feel stays consistent.
export function matchHaptic() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}
