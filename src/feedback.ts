// Small touch feedback (vibration) and the "reduce motion" accessibility setting.
import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform } from "react-native";

let H: typeof import("expo-haptics") | null = null;
try { H = require("expo-haptics"); } catch { H = null; } // missing native module → silent

// Android uses the system haptic constants: they follow the phone's own vibration settings and feel native.
const android = Platform.OS === "android";
export const tap = () => {
  if (!H) return;
  (android ? H.performAndroidHapticsAsync(H.AndroidHaptics.Context_Click) : H.impactAsync(H.ImpactFeedbackStyle.Light)).catch(() => {});
};
export const select = () => {
  if (!H) return;
  (android ? H.performAndroidHapticsAsync(H.AndroidHaptics.Segment_Tick) : H.selectionAsync()).catch(() => {});
};
export const success = () => {
  if (!H) return;
  (android ? H.performAndroidHapticsAsync(H.AndroidHaptics.Confirm) : H.notificationAsync(H.NotificationFeedbackType.Success)).catch(() => {});
};

/** True when the person turned on "Reduce motion": decorative loops stop. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced).catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}
