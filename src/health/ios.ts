// Apple Salud through @kingstinct/react-native-healthkit (v16, Nitro).
// Reads/writes "Menstruación" (menstrual flow) and writes pain as "Calambres abdominales".
// If you upgrade the library to a new major version, this is the only file to adjust.
import {
  CategoryValueMenstrualFlow,
  CategoryValueSeverity,
  isHealthDataAvailable,
  queryCategorySamples,
  requestAuthorization,
  saveCategorySample,
} from "@kingstinct/react-native-healthkit";
import type { State } from "../cycle";
import { periodEnd } from "../cycle";
import { add, diff, key, parse, today } from "../dates";
import { groupDays } from "./group";
import type { HealthAdapter } from "./index";

const FLOW = "HKCategoryTypeIdentifierMenstrualFlow" as const;
const CRAMPS = "HKCategoryTypeIdentifierAbdominalCramps" as const;
// Our pain 0–3 (nada…mucho) → HealthKit severity notPresent…severe
const SEVERITY = [CategoryValueSeverity.notPresent, CategoryValueSeverity.mild, CategoryValueSeverity.moderate, CategoryValueSeverity.severe];

const dayRange = (k: string): [Date, Date] => {
  const end = parse(k);
  end.setHours(23, 59, 0, 0);
  return [parse(k), end];
};

const ios: HealthAdapter = {
  available: async () => isHealthDataAvailable(),

  connect: async () => {
    await requestAuthorization({ toRead: [FLOW, CRAMPS], toShare: [FLOW, CRAMPS] });
    return true; // HealthKit never reveals whether read access was granted
  },

  importData: async (days) => {
    const samples = await queryCategorySamples(FLOW, {
      limit: 0,
      ascending: true,
      filter: { date: { startDate: parse(add(today(), -days)), endDate: new Date() } },
    });
    const bleeding = samples
      .filter((s) => s.value !== CategoryValueMenstrualFlow.none)
      .map((s) => key(new Date(s.startDate)));
    // Days already in Salud are marked as written so they are never saved twice.
    return { periods: groupDays(bleeding, diff), markers: bleeding.map((k) => `flow:${k}`) };
  },

  exportData: async (S: State) => {
    const done = new Set(S.health.written);
    const written: string[] = [];
    for (const p of S.periods) {
      const last = periodEnd(p);
      for (let k = p.start; k <= last; k = add(k, 1)) {
        const mark = `flow:${k}`;
        if (done.has(mark)) continue;
        const [start, end] = dayRange(k);
        await saveCategorySample(FLOW, CategoryValueMenstrualFlow.unspecified, start, end, { HKMenstrualCycleStart: k === p.start });
        written.push(mark);
      }
    }
    for (const [k, d] of Object.entries(S.days)) {
      if (d.pain == null || [...done].some((m) => m.startsWith(`cramps:${k}:`))) continue; // one per day
      const [start, end] = dayRange(k);
      await saveCategorySample(CRAMPS, SEVERITY[d.pain], start, end);
      written.push(`cramps:${k}:${d.pain}`);
    }
    return written;
  },
};

export default ios;
