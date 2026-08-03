import * as Haptics from 'expo-haptics';

// The "match" moment (11-UI-DESIGN.md's signature beat) — fired from every
// place a match is first detected: passenger's waiting screen, the driver's
// accept, and autopool's grouping. One place so the feel stays consistent.
export function matchHaptic() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

// The search settling into its answer — softer than matchHaptic on purpose:
// results arriving is not the same event as being matched, and the two must
// not feel identical in the hand.
export function arriveHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

// Light tick for discrete selections (e.g. picking a time slot).
export function selectionHaptic() {
  Haptics.selectionAsync().catch(() => {});
}

// Soft "no" — a blocked/locked action, e.g. tapping a tab that's locked while
// you're live as a driver.
export function warningHaptic() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}
