import type { Period } from "../cycle";

/** Groups single bleeding days into periods (a gap of 3+ days starts a new period). */
export function groupDays(days: string[], diff: (a: string, b: string) => number): Period[] {
  const sorted = [...new Set(days)].sort();
  const out: Period[] = [];
  for (const d of sorted) {
    const last = out[out.length - 1];
    if (last && diff(last.end!, d) <= 2) last.end = d;
    else out.push({ start: d, end: d });
  }
  return out;
}
