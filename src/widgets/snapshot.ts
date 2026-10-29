// What the home-screen widgets need. Everything that depends on the date (day of cycle, phase, countdown,
// the week strip) is computed when the widget draws, so widgets stay right on later days without opening the app.
// The iOS widget (targets/widget/Model.swift) repeats this same logic in Swift.
import { PAIN } from "../content";
import { cycleInfo, PhaseId, State } from "../cycle";
import { add, diff, fmt, today } from "../dates";

const LETTER = ["D", "L", "M", "X", "J", "V", "S"]; // as on Spanish calendars

export type Snapshot = {
  lastStart: string | null;
  /** The day the last period ended, or null while it's still open (not marked as finished). */
  lastEnd: string | null;
  typical: number | null;
  lo: number | null;
  hi: number | null;
  /** Usual period length in days. */
  dur: number;
  paused: boolean;
  /** Average logged pain 0–3, or null. */
  pain?: number | null;
  /** How many cycles the numbers come from. */
  cycles?: number;
  /** What was logged on `logDay` (the day the app last synced), shown only while it's still that day. */
  logDay?: string;
  log?: { pain: number | null; sym: number; mood: string | null } | null;
};

export function makeSnapshot(S: State): Snapshot {
  const ci = cycleInfo(S), T = today(), d = S.days[T];
  return { lastStart: ci.last?.start ?? null, lastEnd: ci.last?.end ?? null, typical: ci.typical, lo: ci.lo, hi: ci.hi, dur: ci.dur, paused: S.settings.paused,
    pain: ci.pain, cycles: ci.lens.length, logDay: T, log: d ? { pain: d.pain, sym: d.sym.length, mood: d.mood[0] ?? null } : null };
}

/** The phases of a cycle as day ranges: same split as `phases` in src/cycle.ts (ovulation ~14 days before the next period). */
export function segmentsOf(len: number, dur: number): { id: PhaseId; from: number; to: number }[] {
  const d = Math.min(dur, len - 6), ov = Math.max(d + 3, len - 14);
  return ([
    { id: "period", from: 1, to: d }, { id: "follicular", from: d + 1, to: ov - 2 },
    { id: "ovulation", from: ov - 1, to: ov + 1 }, { id: "luteal", from: ov + 2, to: len },
  ] as { id: PhaseId; from: number; to: number }[]).filter((x) => x.to >= x.from);
}

export type DayKind = "period" | "predicted" | "ovulation" | "none";
export const PHASE_NAME: Record<PhaseId, string> = { period: "Regla", follicular: "Folicular", ovulation: "Ovulación", luteal: "Lútea" };
const PHASE_LINE: Record<PhaseId, string> = {
  period: "Cuídate: calor y descanso ayudan.",
  follicular: "Suben los estrógenos y la energía.",
  ovulation: "Días de más flujo y energía.",
  luteal: "Más hambre o sensibilidad es normal.",
};

export type WidgetModel = {
  /** No period recorded yet. */
  empty: boolean;
  day: number | null;
  /** Cycle length used for the ring (typical, or 28 while learning). */
  len: number;
  onPeriod: boolean;
  phase: PhaseId | null;
  phaseName: string;
  phaseLine: string;
  /** Big number + words for the countdown widgets: "12" "días para tu regla". */
  count: { n: string; label: string };
  /** One short line: "Regla en 12 días", "Día 2 de regla", "3 días de retraso"… */
  status: string;
  /** Predicted window, "11 nov – 15 nov", or "". */
  window: string;
  /** Approximate ovulation, "≈ 3 nov", or "". */
  ovulation: string;
  late: number;
  week: { label: string; date: number; kind: DayKind; today: boolean }[];
  /** The most likely day of the next period, "≈ 12 nov", or "". */
  nextDate: string;
  /** "Ovulación en 3 días", "Regla en 9 días"… the next phase change, or "". */
  next: string;
  /** "Ciclo de ~29 días" or "Aprendiendo tu ciclo". */
  cycleLine: string;
  /** The phases as day ranges, for rings and bars (only once the cycle is learned). */
  segs: { id: PhaseId; from: number; to: number }[];
  /** Figures from the records, for the summary widget. */
  stats: { label: string; value: string }[];
  /** What was logged today, "Dolor medio · 2 síntomas · Tranquila", or "". */
  today: string;
};

const phaseOf = (day: number, len: number, dur: number): PhaseId => segmentsOf(len, dur).find((x) => day >= x.from && day <= x.to)?.id ?? "luteal";
const days = (n: number) => `${n} ${n === 1 ? "día" : "días"}`;

/** What was logged today, in one short line. */
function todayLine(s: Snapshot, T: string) {
  if (s.logDay !== T || !s.log) return "";
  const parts = [s.log.pain != null ? `Dolor ${PAIN[s.log.pain].toLowerCase()}` : "", s.log.sym ? `${s.log.sym} ${s.log.sym === 1 ? "síntoma" : "síntomas"}` : "", s.log.mood ?? ""];
  return parts.filter(Boolean).join(" · ");
}

export function widgetModel(s: Snapshot | null, T = today()): WidgetModel {
  const blank: WidgetModel = { empty: true, day: null, len: 28, onPeriod: false, phase: null, phaseName: "", phaseLine: "Marca el inicio de tu regla en la app.",
    count: { n: "—", label: "marca tu regla" }, status: "Marca tu regla", window: "", ovulation: "", late: 0, week: [],
    nextDate: "", next: "", cycleLine: "Con 2 reglas aprendo tu ciclo", segs: [], stats: [], today: "" };
  if (!s || !s.lastStart || s.lastStart > T) return blank;
  const start = s.lastStart, dur = Math.max(1, s.dur || 5);
  const day = diff(start, T) + 1;
  // An open period counts until it's marked as finished, at most 10 days (like the app's calendar).
  const end = s.lastEnd ?? add(start, 9);
  const onPeriod = T <= end;
  const learned = !!s.typical && s.lo != null && s.hi != null;
  const len = learned ? s.typical! : 28;
  const phase = onPeriod ? "period" : learned ? phaseOf(Math.min(day, len), len, dur) : null;

  let status = "", count = { n: String(day), label: "día del ciclo" }, window = "", ovulation = "", late = 0, nextDate = "";
  const predicted = new Set<string>(), ovu = new Set<string>();
  if (learned && !s.paused) {
    const typ = s.typical!;
    const a = add(start, Math.min(s.lo!, typ - 2)), b = add(start, Math.max(s.hi!, typ + 2)), mid = add(start, typ);
    window = `${fmt(a)} – ${fmt(b)}`;
    nextDate = `≈ ${fmt(mid)}`;
    const d = Math.min(dur, typ - 6), ov = Math.max(d + 3, typ - 14);
    ovulation = `≈ ${fmt(add(start, ov - 1))}`;
    for (let c = 1; c <= 2; c++) for (let j = 0; j < dur; j++) predicted.add(add(start, typ * c + j));
    for (let j = -1; j <= 1; j++) ovu.add(add(start, ov - 1 + j));
    const toMid = diff(T, mid);
    if (onPeriod) { status = `Día ${day} de regla`; count = { n: String(day), label: "día de regla" }; }
    else if (T > b) { late = diff(b, T); status = `${late} ${late === 1 ? "día" : "días"} de retraso`; count = { n: String(late), label: late === 1 ? "día de retraso" : "días de retraso" }; }
    else if (T >= a) { status = "Puede llegar ya"; count = { n: toMid > 0 ? String(toMid) : "Ya", label: toMid > 0 ? "días, puede llegar ya" : "puede llegar hoy" }; }
    else { status = toMid === 1 ? "Regla mañana" : `Regla en ${toMid} días`; count = { n: String(toMid), label: toMid === 1 ? "día para tu regla" : "días para tu regla" }; }
  } else if (onPeriod) { status = `Día ${day} de regla`; count = { n: String(day), label: "día de regla" }; }
  else if (s.paused) { status = "Previsiones en pausa"; count = { n: String(day), label: "día del ciclo" }; }
  else { status = "Aprendiendo tu ciclo"; count = { n: String(day), label: "día del ciclo" }; }

  // Today and the next six days: the rest of this period, the predicted one and the ovulation days.
  const periodLeft = onPeriod ? (s.lastEnd ?? add(start, dur - 1)) : "";
  const week = Array.from({ length: 7 }, (_, i) => {
    const k = add(T, i), dt = new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10));
    const kind: DayKind = (onPeriod && k <= periodLeft) || (i === 0 && onPeriod) ? "period" : predicted.has(k) && !onPeriod ? "predicted" : ovu.has(k) ? "ovulation" : "none";
    return { label: LETTER[dt.getDay()], date: dt.getDate(), kind, today: i === 0 };
  });

  // the next phase change within this cycle (the next period when it's the last phase)
  const segs = learned ? segmentsOf(len, dur) : [];
  let next = "";
  if (learned && !s.paused && !late) {
    const up = segs.find((x) => x.from > day);
    const n = up ? up.from - day : len + 1 - day;
    if (n > 0) next = `${up ? PHASE_NAME[up.id] : "Regla"} ${n === 1 ? "mañana" : `en ${n} días`}`;
  }
  const stats = [
    // short values: four of them share a widget's width
    { label: "Días de ciclo", value: s.typical ? (s.lo === s.hi ? `${s.typical}` : `${s.lo}–${s.hi}`) : "—" },
    { label: "Días de regla", value: `${dur}` },
    { label: "Dolor medio", value: s.pain != null ? PAIN[Math.round(s.pain)] : "—" },
    { label: "Última regla", value: fmt(start) },
  ];

  return { empty: false, day, len, onPeriod, phase, phaseName: phase ? PHASE_NAME[phase] : "Aprendiendo", phaseLine: phase ? PHASE_LINE[phase] : "Con 2 reglas conoceré tus fases.",
    count, status, window, ovulation, late, week, nextDate, next,
    cycleLine: learned ? `Ciclo de ~${s.typical} días` : "Aprendiendo tu ciclo", segs, stats, today: todayLine(s, T) };
}
