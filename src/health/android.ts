// Android Health Connect through react-native-health-connect (v3 API).
// Reads MenstruationPeriod + MenstruationFlow, writes MenstruationPeriod once a period has ended.
import {
  getSdkStatus,
  initialize,
  insertRecords,
  readRecords,
  requestPermission,
  SdkAvailabilityStatus,
} from "react-native-health-connect";
import type { Period, State } from "../cycle";
import { add, diff, key, parse, today } from "../dates";
import { groupDays } from "./group";
import type { HealthAdapter } from "./index";

const PERMS = [
  { accessType: "read", recordType: "MenstruationPeriod" },
  { accessType: "write", recordType: "MenstruationPeriod" },
  { accessType: "read", recordType: "MenstruationFlow" },
] as const;

let inited = false;
async function init() {
  if (!inited) inited = await initialize();
  return inited;
}

const android: HealthAdapter = {
  available: async () => (await getSdkStatus()) === SdkAvailabilityStatus.SDK_AVAILABLE,

  connect: async () => {
    if (!(await init())) return false;
    const granted = await requestPermission(PERMS as any);
    return granted.some((g: any) => g.recordType === "MenstruationPeriod" && g.accessType === "write");
  },

  importData: async (days) => {
    if (!(await init())) return { periods: [], markers: [] };
    const timeRangeFilter = {
      operator: "between" as const,
      startTime: parse(add(today(), -days)).toISOString(),
      endTime: new Date().toISOString(),
    };
    const periods: Period[] = [];
    const per: any = await readRecords("MenstruationPeriod", { timeRangeFilter });
    for (const r of per.records ?? []) {
      const end = new Date(new Date(r.endTime).getTime() - 1); // endTime is exclusive
      periods.push({ start: key(new Date(r.startTime)), end: key(end) });
    }
    const flow: any = await readRecords("MenstruationFlow", { timeRangeFilter });
    const flowDays = (flow.records ?? []).map((r: any) => key(new Date(r.time)));
    const all = [...periods, ...groupDays(flowDays, diff)];
    // Periods already in Health Connect are marked as written so they are never saved twice.
    return { periods: all, markers: all.map((p) => `period:${p.start}:${p.end}`) };
  },

  exportData: async (S: State) => {
    if (!(await init())) return [];
    const done = new Set(S.health.written);
    const written: string[] = [];
    for (const p of S.periods) {
      if (!p.end) continue; // write finished periods only, so the record never needs editing
      const mark = `period:${p.start}:${p.end}`;
      if (done.has(mark)) continue;
      await insertRecords([
        {
          recordType: "MenstruationPeriod",
          startTime: parse(p.start).toISOString(),
          endTime: parse(add(p.end, 1)).toISOString(),
        } as any,
      ]);
      written.push(mark);
    }
    return written;
  },
};

export default android;
