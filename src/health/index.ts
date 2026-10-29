// One interface over Apple Salud (HealthKit) and Android Health Connect.
// Each platform file is loaded only on its own platform.
import { isRunningInExpoGo } from "expo";
import { Platform } from "react-native";
import type { Period, State } from "../cycle";

export type HealthAdapter = {
  available: () => Promise<boolean>;
  connect: () => Promise<boolean>;
  /** Periods (and pain, where the platform stores it) from the last `days` days. */
  importData: (days: number) => Promise<{ periods: Period[]; markers: string[] }>;
  /** Writes what is not yet in the health app; returns markers for what was written. */
  exportData: (S: State) => Promise<string[]>;
};

const noop: HealthAdapter = {
  available: async () => false,
  connect: async () => false,
  importData: async () => ({ periods: [], markers: [] }),
  exportData: async () => [],
};

// Expo Go doesn't include the HealthKit / Health Connect native modules: there the app runs without them.
const inExpoGo = isRunningInExpoGo();
const adapter: HealthAdapter = inExpoGo ? noop
  : Platform.OS === "ios" ? require("./ios").default : Platform.OS === "android" ? require("./android").default : noop;

export const healthName = Platform.OS === "ios" ? "Salud" : "Health Connect";
export const healthUnavailable = inExpoGo
  ? `${healthName} funciona en la app instalada, no en Expo Go.`
  : `${healthName} no está disponible en este móvil.`;
export const healthAvailable = () => adapter.available().catch(() => false);
export const connectHealth = () => adapter.connect().catch(() => false);
export const importFromHealth = (days = 365) => adapter.importData(days);
export const exportToHealth = (S: State) => adapter.exportData(S);
