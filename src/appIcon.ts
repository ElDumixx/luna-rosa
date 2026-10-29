// App icon styles for Android (drawn by scripts/make-icons.swift, registered in app.config.ts).
// Android swaps the icon by switching between launcher aliases of the same app, so nothing is lost.
import { isRunningInExpoGo } from "expo";
import { Platform } from "react-native";

export const ICONS = [
  { name: null, label: "Clásico", preview: require("../assets/icons/clasico-preview.png") },
  { name: "Cristal", label: "Cristal", preview: require("../assets/icons/cristal-preview.png") },
  { name: "Noche", label: "Noche", preview: require("../assets/icons/noche-preview.png") },
  { name: "Perla", label: "Perla", preview: require("../assets/icons/perla-preview.png") },
  { name: "Atardecer", label: "Atardecer", preview: require("../assets/icons/atardecer-preview.png") },
  { name: "Lavanda", label: "Lavanda", preview: require("../assets/icons/lavanda-preview.png") },
] as const;

const mod = () => (Platform.OS === "android" && !isRunningInExpoGo() ? require("expo-alternate-app-icons") : null);
export const iconStylesAvailable = Platform.OS === "android" && !isRunningInExpoGo();
export const currentIcon = (): string | null => { try { return mod()?.getAppIconName() ?? null; } catch { return null; } };
export const setIcon = async (name: string | null) => { await mod()?.setAlternateAppIcon(name); };
