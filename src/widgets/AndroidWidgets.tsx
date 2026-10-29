// Android home-screen widgets in the app's "Pétalo" style: blush cards, petal-shaped tiles, pastel phase colors and
// the app's fonts (Fraunces for numbers and titles). Each comes in a light and a dark version (the launcher picks the
// one that matches the system theme). The names here must match the `widgets` list in app.config.ts.
import React from "react";
import { FlexWidget, OverlapWidget, SvgWidget, TextWidget } from "react-native-android-widget";
import type { ColorProp } from "react-native-android-widget/lib/typescript/widgets/utils/style.props";
import type { PhaseId } from "../cycle";
import { DayKind, Snapshot, widgetModel, WidgetModel } from "./snapshot";

type Hex = `#${string}`;
type Tone = {
  bg: Hex; tile: Hex; ink: Hex; muted: Hex; accent: Hex; line: Hex; onFill: Hex; ring: Hex;
  phase: Record<PhaseId, Hex>; deep: Record<PhaseId, Hex>;
};
// Same tones as the app theme (src/theme.ts).
const LIGHT: Tone = { bg: "#FFF4F7", tile: "#FFFFFF", ink: "#3A1F2D", muted: "#86677A", accent: "#C2457A", line: "#F1DDE6", onFill: "#3A1F2D", ring: "#FFFFFF",
  phase: { period: "#F4A6C0", follicular: "#FFCDB2", ovulation: "#CDBBFF", luteal: "#B5E3D2" },
  deep: { period: "#B23A6A", follicular: "#A8542B", ovulation: "#5E44B8", luteal: "#2C7A61" } };
const DARK: Tone = { bg: "#221820", tile: "#2E212A", ink: "#FBEFF4", muted: "#C7AABA", accent: "#F49BBE", line: "#3A2A33", onFill: "#2A1321", ring: "#221820",
  phase: { period: "#E98AAD", follicular: "#E3A783", ovulation: "#A994EC", luteal: "#7FBFA9" },
  deep: { period: "#F7B7CC", follicular: "#FFCDB2", ovulation: "#D9CCFF", luteal: "#BDE8D8" } };

const SERIF = "Fraunces_600SemiBold", ITALIC = "Fraunces_600SemiBold_Italic", BODY = "Nunito_600SemiBold", BOLD = "Nunito_800ExtraBold";
export type Size = { width: number; height: number };

/** The petal: two opposite corners round, the other two tighter. */
const petal = (r: number) => ({ borderTopLeftRadius: r, borderBottomRightRadius: r, borderTopRightRadius: Math.round(r * 0.4), borderBottomLeftRadius: Math.round(r * 0.4) });
/** "#RRGGBB" at some opacity, as rgba(): Android reads 8-digit hex colors as #AARRGGBB, not #RRGGBBAA. */
const fade = (hex: Hex, a: number): ColorProp => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};
const fillOf = (t: Tone, m: WidgetModel): Hex => (m.phase ? t.phase[m.phase] : t.phase.period);
const deepOf = (t: Tone, m: WidgetModel): Hex => (m.phase ? t.deep[m.phase] : t.accent);
const kindColor = (t: Tone, k: DayKind): Hex | "" => (k === "period" ? t.phase.period : k === "ovulation" ? t.phase.ovulation : "");

function Shell({ t, children, uri, pad = 14, label, row }: { t: Tone; children: React.ReactNode; uri?: string; pad?: number; label: string; row?: boolean }) {
  return (
    <FlexWidget clickAction={uri ? "OPEN_URI" : "OPEN_APP"} clickActionData={uri ? { uri } : undefined} accessibilityLabel={label}
      style={{ height: "match_parent", width: "match_parent", borderRadius: 28, padding: pad, backgroundColor: t.bg,
        flexDirection: row ? "row" : "column", justifyContent: "space-between", alignItems: row ? "center" : "flex-start" }}>
      {children}
    </FlexWidget>
  );
}

const Txt = ({ text, size, color, f = BODY, lines = 1, align }: { text: string; size: number; color: ColorProp; f?: string; lines?: number; align?: "left" | "center" | "right" }) => (
  <TextWidget text={text} maxLines={lines} truncate="END" style={{ fontSize: size, color, fontFamily: f, textAlign: align }} />
);
const Gap = ({ w = 0, h = 0 }: { w?: number; h?: number }) => <FlexWidget style={{ width: w || 1, height: h || 1 }} />;

/** A small pill in the phase's pastel with its name in the deep shade. */
function PhasePill({ t, m }: { t: Tone; m: WidgetModel }) {
  return (
    <FlexWidget style={{ borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: m.empty ? t.line : fillOf(t, m) }}>
      <Txt text={m.empty ? "Luna Rosa" : m.phaseName} size={11} color={t === DARK ? t.onFill : deepOf(t, m)} f={BOLD} />
    </FlexWidget>
  );
}

/** The phases as a bar, the lived part full strength, with a marker on today. Falls back to a pink progress bar. */
function PhaseBar({ t, m, width, h = 10 }: { t: Tone; m: WidgetModel; width: number; h?: number }) {
  const segs = m.segs.length ? m.segs : [{ id: "period" as PhaseId, from: 1, to: m.len }];
  const day = Math.min(m.day ?? 0, m.len), x = Math.round(((day - 0.5) / m.len) * width), dot = h + 6;
  return (
    <OverlapWidget style={{ width, height: dot }}>
      <FlexWidget style={{ width, height: dot, justifyContent: "center" }}>
        <FlexWidget style={{ width, height: h, flexDirection: "row", borderRadius: h / 2, backgroundColor: t.line }}>
          {segs.map((s, i) => (
            <FlexWidget key={s.id} style={{ flex: s.to - s.from + 1, height: h, marginLeft: i ? 2 : 0, borderRadius: h / 2,
              backgroundColor: s.from <= day ? t.phase[s.id] : fade(t.phase[s.id], 0.4) }} />
          ))}
        </FlexWidget>
      </FlexWidget>
      {!m.empty && (
        <FlexWidget style={{ marginLeft: Math.max(0, Math.min(width - dot, x - dot / 2)), width: dot, height: dot, borderRadius: dot / 2, backgroundColor: t.ring,
          borderWidth: 3, borderColor: t.accent }} />
      )}
    </OverlapWidget>
  );
}

/** Arc of the r=40 ring from fraction a to b, clockwise from 12 o'clock (explicit paths: Android's SVG renderer
 * doesn't start circles where browsers do, so rotated dash tricks land in the wrong place). */
function arc(a: number, b: number) {
  const pt = (f: number) => { const x = -Math.PI / 2 + f * 2 * Math.PI; return `${(50 + 40 * Math.cos(x)).toFixed(2)} ${(50 + 40 * Math.sin(x)).toFixed(2)}`; };
  if (b - a >= 0.999) return `M ${pt(a)} A 40 40 0 1 1 ${pt(a + 0.5)} A 40 40 0 1 1 ${pt(a)}`;
  return `M ${pt(a)} A 40 40 0 ${b - a > 0.5 ? 1 : 0} 1 ${pt(b)}`;
}

/** The cycle as four pastel arcs (like the ring in the app): lived days full strength, a dot on today. */
function ringSvg(m: WidgetModel, t: Tone) {
  const segs = m.segs.length ? m.segs : [{ id: "period" as PhaseId, from: 1, to: m.len }];
  const day = Math.min(m.day ?? 0, m.len), gap = 0.014;
  const paths = segs.map((s) => {
    const a = (s.from - 1) / m.len + gap / 2, b = s.to / m.len - gap / 2, lived = Math.min(b, Math.max(a, day / m.len));
    return `<path d="${arc(a, b)}" fill="none" stroke="${t.phase[s.id]}" stroke-opacity="0.38" stroke-width="10" stroke-linecap="round"/>`
      + (!m.empty && lived > a ? `<path d="${arc(a, lived)}" fill="none" stroke="${t.phase[s.id]}" stroke-width="10" stroke-linecap="round"/>` : "");
  }).join("");
  const x = -Math.PI / 2 + ((day - 0.5) / m.len) * 2 * Math.PI;
  const dot = m.empty ? "" : `<circle cx="${(50 + 40 * Math.cos(x)).toFixed(2)}" cy="${(50 + 40 * Math.sin(x)).toFixed(2)}" r="7.5" fill="${t.ring}" stroke="${t.accent}" stroke-width="3.5"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${paths}${dot}</svg>`;
}

// ---- the widgets ----

/** 2×2: the day of the cycle, its phase, what comes next and a phase bar. */
function Day({ m, t, size }: { m: WidgetModel; t: Tone; size: Size }) {
  return (
    <Shell t={t} label={m.empty ? "Luna Rosa: marca tu regla" : `Día ${m.day} del ciclo, ${m.phaseName}. ${m.status}`}>
      <PhasePill t={t} m={m} />
      <FlexWidget style={{ flexDirection: "column" }}>
        <Txt text={m.empty ? "—" : String(m.day)} size={46} color={t.ink} f={SERIF} />
        <Txt text={m.empty ? "Marca tu regla" : m.status} size={12} color={m.late ? t.deep.period : t.muted} f={BOLD} />
      </FlexWidget>
      <PhaseBar t={t} m={m} width={Math.max(60, size.width - 28)} h={8} />
    </Shell>
  );
}

/** 2×2: the cycle ring with the day and the phase in the middle. */
function Ring({ m, t, size }: { m: WidgetModel; t: Tone; size: Size }) {
  const side = Math.max(70, Math.min(size.width, size.height) - 16);
  return (
    <FlexWidget clickAction="OPEN_APP" accessibilityLabel={m.empty ? "Luna Rosa" : `Día ${m.day} de ${m.len}, ${m.phaseName}`}
      style={{ height: "match_parent", width: "match_parent", borderRadius: 28, alignItems: "center", justifyContent: "center", backgroundColor: t.bg }}>
      <OverlapWidget style={{ width: side, height: side }}>
        <SvgWidget svg={ringSvg(m, t)} style={{ width: side, height: side }} />
        <FlexWidget style={{ width: side, height: side, flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <Txt text={m.empty ? "—" : String(m.day)} size={Math.round(side * 0.27)} color={t.ink} f={SERIF} />
          <Txt text={m.empty ? "Luna Rosa" : m.phaseName.toLowerCase()} size={11} color={deepOf(t, m)} f={BOLD} />
          {!!m.nextDate && !m.onPeriod && <Txt text={m.nextDate.replace("≈ ", "regla ≈ ")} size={10} color={t.muted} f={BOLD} />}
        </FlexWidget>
      </OverlapWidget>
    </FlexWidget>
  );
}

/** 2×2: days to the next period (or which day of it, or how late), with its approximate date. */
function Countdown({ m, t }: { m: WidgetModel; t: Tone }) {
  const head = m.onPeriod ? "Con la regla" : m.late ? "Retraso" : "Próxima regla";
  return (
    <Shell t={t} label={`${head}: ${m.count.n} ${m.count.label}. ${m.nextDate}`}>
      <Txt text={head} size={12} color={m.late ? t.deep.period : t.accent} f={BOLD} />
      <FlexWidget style={{ flexDirection: "column" }}>
        <Txt text={m.count.n} size={m.count.n.length > 3 ? 34 : 48} color={t.ink} f={SERIF} />
        <Txt text={m.count.label} size={12} color={t.muted} f={BOLD} lines={2} />
      </FlexWidget>
      <FlexWidget style={{ ...petal(12), paddingHorizontal: 9, paddingVertical: 4, backgroundColor: t.phase.period }}>
        <Txt text={m.onPeriod ? `Suele durar ${m.stats[1]?.value ?? "5"} días` : m.nextDate || m.cycleLine} size={11} color={t.onFill} f={BOLD} />
      </FlexWidget>
    </Shell>
  );
}

/** 4×2: a petal with the day, and the window of the next period, the ovulation and the cycle length. */
function Next({ m, t }: { m: WidgetModel; t: Tone }) {
  return (
    <Shell t={t} row pad={12} label={`Día ${m.day ?? ""}. ${m.status}. ${m.window}. Ovulación ${m.ovulation}`}>
      <FlexWidget style={{ ...petal(26), height: "match_parent", width: 104, padding: 12, backgroundColor: fillOf(t, m), flexDirection: "column", justifyContent: "space-between" }}>
        <Txt text="Día" size={12} color={t.onFill} f={BOLD} />
        <Txt text={m.empty ? "—" : String(m.day)} size={40} color={t.onFill} f={SERIF} />
        <Txt text={m.empty ? "" : m.phaseName} size={12} color={t.onFill} f={BOLD} />
      </FlexWidget>
      <FlexWidget style={{ flexDirection: "column", flex: 1, height: "match_parent", marginLeft: 14, justifyContent: "space-between", paddingVertical: 2 }}>
        <FlexWidget style={{ flexDirection: "column" }}>
          <Txt text={m.window ? "Próxima regla" : m.onPeriod ? "Con la regla" : "Tu ciclo"} size={12} color={t.accent} f={BOLD} />
          <Txt text={m.window || m.status} size={20} color={t.ink} f={SERIF} />
          <Txt text={m.window ? m.status : m.cycleLine} size={12} color={m.late ? t.deep.period : t.muted} f={BOLD} />
        </FlexWidget>
        <FlexWidget style={{ flexDirection: "row" }}>
          {!!m.ovulation && <Chip t={t} text={`Ovulación ${m.ovulation}`} fill={t.phase.ovulation} />}
          {!!m.ovulation && <Gap w={6} />}
          <Chip t={t} text={m.segs.length ? m.cycleLine.replace("Ciclo de ", "Ciclo ") : "Aprendiendo"} fill={t.line} />
        </FlexWidget>
      </FlexWidget>
    </Shell>
  );
}

const Chip = ({ t, text, fill }: { t: Tone; text: string; fill: Hex }) => (
  <FlexWidget style={{ borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: fill }}>
    <Txt text={text} size={10} color={fill === t.line ? t.ink : t.onFill} f={BOLD} />
  </FlexWidget>
);

/** 4×2: the phase, what it means, a bar of the cycle's phases and what comes next. */
function Phase({ m, t, size }: { m: WidgetModel; t: Tone; size: Size }) {
  return (
    <Shell t={t} pad={16} label={`Fase ${m.phaseName}. ${m.phaseLine}. ${m.next}`}>
      <FlexWidget style={{ flexDirection: "row", alignItems: "center", width: "match_parent", justifyContent: "space-between" }}>
        <Txt text="Tu fase" size={12} color={t.accent} f={BOLD} />
        <Txt text={m.empty ? "" : `Día ${m.day} de ~${m.len}`} size={12} color={t.muted} f={BOLD} />
      </FlexWidget>
      <FlexWidget style={{ flexDirection: "column" }}>
        <Txt text={m.empty ? "Luna Rosa" : m.phaseName} size={24} color={deepOf(t, m)} f={SERIF} />
        <Txt text={m.phaseLine} size={12} color={t.muted} lines={1} />
      </FlexWidget>
      <PhaseBar t={t} m={m} width={Math.max(120, size.width - 32)} />
      <Txt text={m.next || (m.ovulation ? `Ovulación ${m.ovulation}` : m.status)} size={12} color={t.ink} f={BOLD} />
    </Shell>
  );
}

/** 4×2 or bigger: this week as petal pebbles (period, predicted, ovulation), the status, and today's log when taller. */
function Week({ m, t, size }: { m: WidgetModel; t: Tone; size: Size }) {
  const pad = 14, cell = Math.floor((size.width - pad * 2) / 7), disc = Math.max(24, Math.min(36, cell - 6));
  const tall = size.height >= 150;
  const legend: [Hex, string][] = [[t.phase.period, "Regla"], [t.line, "Prevista"], [t.phase.ovulation, "Ovulación"]];
  return (
    <Shell t={t} pad={pad} uri="lunarosa://calendar" label={`Esta semana. ${m.status}`}>
      <FlexWidget style={{ flexDirection: "row", width: "match_parent", justifyContent: "space-between", alignItems: "center" }}>
        <Txt text={m.status} size={14} color={m.late ? t.deep.period : t.ink} f={BOLD} />
        <Txt text={m.nextDate || m.window} size={12} color={t.muted} f={BOLD} />
      </FlexWidget>
      <FlexWidget style={{ flexDirection: "row", width: "match_parent", justifyContent: "space-between" }}>
        {(m.week.length ? m.week : Array.from({ length: 7 }, (_, i) => ({ label: " ", date: i + 1, kind: "none" as DayKind, today: i === 0 }))).map((d, i) => {
          const fill = kindColor(t, d.kind);
          return (
            <FlexWidget key={i} style={{ flexDirection: "column", alignItems: "center", width: cell }}>
              <Txt text={d.label} size={11} color={d.today ? t.accent : t.muted} f={BOLD} />
              <FlexWidget style={{ marginTop: 4, width: disc, height: disc, ...petal(disc * 0.45), alignItems: "center", justifyContent: "center",
                backgroundColor: fill || t.tile, borderWidth: d.today ? 2 : d.kind === "predicted" ? 1.5 : 0,
                borderColor: d.today ? t.accent : t.phase.period, borderStyle: d.kind === "predicted" && !d.today ? "dashed" : "solid" }}>
                <Txt text={String(d.date)} size={13} color={fill ? t.onFill : d.today ? t.accent : t.ink} f={SERIF} />
              </FlexWidget>
            </FlexWidget>
          );
        })}
      </FlexWidget>
      {tall ? (
        <FlexWidget style={{ flexDirection: "column", width: "match_parent" }}>
          <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
            {legend.map(([c, l]) => (
              <FlexWidget key={l} style={{ flexDirection: "row", alignItems: "center", marginRight: 12 }}>
                <FlexWidget style={{ width: 9, height: 9, ...petal(5), backgroundColor: c }} />
                <Gap w={5} />
                <Txt text={l} size={11} color={t.muted} f={BOLD} />
              </FlexWidget>
            ))}
          </FlexWidget>
          <Gap h={6} />
          <Txt text={m.today ? `Hoy: ${m.today}` : m.next || m.cycleLine} size={12} color={t.ink} f={BOLD} />
        </FlexWidget>
      ) : <Gap h={1} />}
    </Shell>
  );
}

/** 4×1: today in one line (and what you logged), with a button that opens today's log. */
function Quick({ m, t }: { m: WidgetModel; t: Tone }) {
  return (
    <Shell t={t} row pad={10} label={`${m.status}. ${m.today}. Registrar hoy`}>
      <FlexWidget style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
        <FlexWidget style={{ width: 40, height: 40, ...petal(18), alignItems: "center", justifyContent: "center", backgroundColor: fillOf(t, m) }}>
          <Txt text={m.empty ? "·" : String(m.day)} size={17} color={t.onFill} f={SERIF} />
        </FlexWidget>
        <FlexWidget style={{ flexDirection: "column", marginLeft: 10, flex: 1 }}>
          <Txt text={m.status} size={14} color={m.late ? t.deep.period : t.ink} f={BOLD} />
          <Txt text={m.today ? `Hoy: ${m.today}` : m.empty ? "Luna Rosa" : `Día ${m.day} · ${m.phaseName} · sin registro hoy`} size={11} color={t.muted} />
        </FlexWidget>
      </FlexWidget>
      <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: "lunarosa://day/hoy" }} accessibilityLabel="Registrar hoy"
        style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: t.accent }}>
        <Txt text={m.today ? "Editar" : "Registrar"} size={13} color={t === DARK ? t.onFill : "#FFFFFF"} f={BOLD} />
      </FlexWidget>
    </Shell>
  );
}

/** 4×2: your figures: typical cycle, period length, average pain and last period, as four petal tiles. */
function Summary({ m, t, size }: { m: WidgetModel; t: Tone; size: Size }) {
  const tiles: [string, string, PhaseId][] = m.stats.length
    ? m.stats.map((s, i) => [s.value, s.label, (["luteal", "period", "follicular", "ovulation"] as PhaseId[])[i]])
    : [["—", "Días de ciclo", "luteal"], ["—", "Días de regla", "period"], ["—", "Dolor medio", "follicular"], ["—", "Última regla", "ovulation"]];
  const w = Math.floor((size.width - 28 - 18) / 4);
  return (
    <Shell t={t} pad={14} label={`Tus datos. ${tiles.map(([v, l]) => `${l}: ${v}`).join(". ")}`}>
      <FlexWidget style={{ flexDirection: "row", width: "match_parent", justifyContent: "space-between", alignItems: "center" }}>
        <Txt text="Tus datos" size={15} color={t.accent} f={ITALIC} />
        <Txt text={m.empty ? "" : `Día ${m.day} · ${m.phaseName}`} size={12} color={t.muted} f={BOLD} />
      </FlexWidget>
      <FlexWidget style={{ flexDirection: "row", width: "match_parent", justifyContent: "space-between" }}>
        {tiles.map(([v, l, p]) => (
          <FlexWidget key={l} style={{ width: w, ...petal(18), padding: 8, backgroundColor: t.tile, flexDirection: "column" }}>
            <FlexWidget style={{ width: 14, height: 4, borderRadius: 2, backgroundColor: t.phase[p] }} />
            <Gap h={6} />
            <Txt text={v} size={15} color={t.ink} f={SERIF} />
            <Txt text={l} size={10} color={t.muted} f={BOLD} lines={2} />
          </FlexWidget>
        ))}
      </FlexWidget>
    </Shell>
  );
}

type Render = (m: WidgetModel, t: Tone, size: Size) => React.JSX.Element;
const VIEWS: Record<string, Render> = {
  LunaSmall: (m, t, size) => <Day m={m} t={t} size={size} />,
  LunaRing: (m, t, size) => <Ring m={m} t={t} size={size} />,
  LunaCountdown: (m, t) => <Countdown m={m} t={t} />,
  LunaMedium: (m, t) => <Next m={m} t={t} />,
  LunaPhase: (m, t, size) => <Phase m={m} t={t} size={size} />,
  LunaWeek: (m, t, size) => <Week m={m} t={t} size={size} />,
  LunaQuick: (m, t) => <Quick m={m} t={t} />,
  LunaSummary: (m, t, size) => <Summary m={m} t={t} size={size} />,
};
export const WIDGET_NAMES = Object.keys(VIEWS);

/** Light and dark versions of a widget for the launcher. */
export function renderWidget(name: string, snap: Snapshot | null, size: Size) {
  const view = VIEWS[name] ?? VIEWS.LunaSmall, m = widgetModel(snap);
  return { light: view(m, LIGHT, size), dark: view(m, DARK, size) };
}

/** One version, for the previews inside the app. */
export function previewWidget(name: string, snap: Snapshot | null, size: Size, dark: boolean) {
  return (VIEWS[name] ?? VIEWS.LunaSmall)(widgetModel(snap), dark ? DARK : LIGHT, size);
}
