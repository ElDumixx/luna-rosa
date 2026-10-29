// Cycle model learned from what the user records: no "how long is your cycle" question.
import { add, diff, median, minK, today } from "./dates";

export type Period = { start: string; end: string | null };
export type DayLog = {
  pain: number | null; // 0 nada, 1 poco, 2 medio, 3 mucho
  sym: string[];
  med: { taken: boolean; name: string };
  mood: string[];
  crave: string[];
};
export type Settings = {
  remind: boolean;
  paused: boolean;
  useData: boolean;
  healthSync: boolean;
};
export type State = {
  periods: Period[];
  days: Record<string, DayLog>;
  settings: Settings;
  custom: { sym: string[]; mood: string[]; crave: string[] };
  dismissed: string;
  health: { written: string[]; lastImport: string | null };
};

export const EMPTY = (): State => ({
  periods: [],
  days: {},
  settings: { remind: true, paused: false, useData: true, healthSync: false },
  custom: { sym: [], mood: [], crave: [] },
  dismissed: "",
  health: { written: [], lastImport: null },
});

export const emptyDay = (): DayLog => ({ pain: null, sym: [], med: { taken: false, name: "" }, mood: [], crave: [] });

// An open period (no end yet) is drawn up to today, at most 10 days.
export const periodEnd = (p: Period) => p.end ?? minK(add(p.start, 9), today());

export function periodAt(S: State, k: string) {
  return S.periods.find((p) => k >= p.start && k <= periodEnd(p));
}

/** Period days between two keys (inclusive) with their period, in one pass instead of a search per day. */
export function periodDays(S: State, from: string, to: string) {
  const m = new Map<string, Period>();
  for (const p of S.periods) {
    const e = periodEnd(p);
    if (e < from || p.start > to) continue;
    for (let k = p.start > from ? p.start : from; k <= e && k <= to; k = add(k, 1)) m.set(k, p);
  }
  return m;
}

/** True when the day has anything logged besides period marks. */
export const hasLog = (d?: DayLog) => !!d && (d.pain != null || d.sym.length > 0 || d.mood.length > 0 || d.crave.length > 0 || d.med.taken);

export type CycleInfo = ReturnType<typeof cycleInfo>;
export function cycleInfo(S: State) {
  const T = today();
  const ps = S.periods;
  const lens: number[] = [];
  for (let i = 1; i < ps.length; i++) {
    const l = diff(ps[i - 1].start, ps[i].start);
    if (l >= 15 && l <= 60) lens.push(l); // longer gaps = pause, loss, pregnancy… not a cycle
  }
  const recent = lens.slice(-6);
  const typical = median(recent);
  const lo = recent.length ? Math.min(...recent) : null;
  const hi = recent.length ? Math.max(...recent) : null;
  const durs = ps.filter((p) => p.end).map((p) => diff(p.start, p.end!) + 1).slice(-6);
  const dur = median(durs) ?? 5;
  const last = ps[ps.length - 1] ?? null;
  const dayOf = last ? diff(last.start, T) + 1 : null;
  let win: { start: string; end: string; mid: string } | null = null;
  if (last && typical && lo != null && hi != null && !S.settings.paused) {
    win = {
      start: add(last.start, Math.min(lo, typical - 2)),
      end: add(last.start, Math.max(hi, typical + 2)),
      mid: add(last.start, typical),
    };
  }
  const painVals = Object.values(S.days).map((d) => d.pain).filter((p): p is number => p != null);
  const pain = painVals.length ? painVals.reduce((a, b) => a + b, 0) / painVals.length : null;
  return { lens, recent, typical, lo, hi, dur, last, dayOf, win, pain };
}

export type PhaseId = "period" | "follicular" | "ovulation" | "luteal";
export const PHASE_TEXT: Record<PhaseId, { name: string; text: string }> = {
  period: { name: "Regla", text: "El endometrio se desprende. Cansancio y cólicos son habituales estos días." },
  follicular: { name: "Folicular", text: "Los estrógenos suben y un folículo madura en el ovario." },
  ovulation: { name: "Ovulación (aprox.)", text: "Se libera un óvulo. La fecha exacta varía de un ciclo a otro." },
  luteal: { name: "Lútea", text: "Sube la progesterona: más hambre o sensibilidad es fisiológico." },
};

/**
 * Approximate phases of the learned cycle. Ovulation is placed ~14 days before the next period
 * (not on day 14), since the luteal phase is the more stable one. Null until the cycle is learned.
 */
export function phases(ci: CycleInfo) {
  if (!ci.last || !ci.typical || ci.dayOf == null) return null;
  const len = ci.typical, dur = Math.min(ci.dur, len - 6);
  const ov = Math.max(dur + 3, len - 14);
  const seg: { id: PhaseId; from: number; to: number }[] = [
    { id: "period", from: 1, to: dur },
    { id: "follicular", from: dur + 1, to: ov - 2 },
    { id: "ovulation", from: ov - 1, to: ov + 1 },
    { id: "luteal", from: ov + 2, to: len },
  ].filter((x) => x.to >= x.from) as { id: PhaseId; from: number; to: number }[];
  const day = ci.dayOf;
  const current = day > len ? "luteal" : seg.find((x) => day >= x.from && day <= x.to)?.id ?? "luteal";
  return { len, day, seg, current: current as PhaseId, late: day > len };
}

export function predictedSet(S: State, ci: CycleInfo) {
  const set = new Set<string>();
  if (!ci.win || !ci.last || !ci.typical) return set;
  const T = today();
  for (let c = 1; c <= 4; c++) {
    const st = add(ci.last.start, ci.typical * c);
    for (let j = 0; j < ci.dur; j++) {
      const k = add(st, j);
      if (k > T && !periodAt(S, k)) set.add(k);
    }
  }
  return set;
}

// ---- edits ----
const sort = (S: State) => S.periods.sort((a, b) => (a.start < b.start ? -1 : 1));
function fixOverlaps(S: State) {
  for (let i = 1; i < S.periods.length; i++) {
    const a = S.periods[i - 1], b = S.periods[i];
    if (a.end && a.end >= b.start) {
      a.end = b.end && b.end > a.end ? b.end : a.end;
      S.periods.splice(i, 1);
      i--;
    }
  }
}
export function setStart(S: State, k: string) {
  const p = periodAt(S, k);
  if (p) p.start = k;
  else {
    const next = S.periods.find((x) => x.start > k);
    if (next && diff(k, next.start) <= 3) next.start = k;
    else S.periods.push({ start: k, end: null });
  }
  sort(S); fixOverlaps(S);
}
export function setEnd(S: State, k: string) {
  const prev = [...S.periods].reverse().find((p) => p.start <= k);
  if (prev && diff(prev.start, k) <= 14) prev.end = k;
  else S.periods.push({ start: k, end: k });
  sort(S); fixOverlaps(S);
}
export function removePeriod(S: State, k: string) {
  const p = periodAt(S, k);
  if (p) S.periods = S.periods.filter((x) => x !== p);
}
/** Adds periods coming from Salud / Health Connect that don't overlap existing ones. */
export function mergePeriods(S: State, incoming: Period[]) {
  let added = 0;
  for (const p of incoming) {
    const end = p.end ?? p.start;
    const clash = S.periods.some((x) => !(end < x.start || p.start > periodEnd(x)));
    if (!clash) { S.periods.push({ ...p }); added++; }
  }
  sort(S); fixOverlaps(S);
  return added;
}
