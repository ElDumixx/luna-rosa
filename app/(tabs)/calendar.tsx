import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import React, { memo, useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeInLeft, FadeInRight, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { Columns, Screen } from "../../src/components/Screen";
import { Badge, Btn, Card, CardHead, IconBtn } from "../../src/components/ui";
import { hasLog, Period, periodDays, periodEnd } from "../../src/cycle";
import { add, diff, fmt, fmtLong, key, MESL, parse, today } from "../../src/dates";
import { select, tap } from "../../src/feedback";
import { useStore } from "../../src/store";
import { font, motion, painColor, Palette, sunken, tight, useLayout, useTheme } from "../../src/theme";

type CellProps = {
  k: string; c: Palette; cellH: number; dot: number; out: boolean; isToday: boolean;
  period: Period | undefined; pred: boolean; logged: boolean; pain: number | null;
};

// One day of the grid. Memoized: a swipe or a log on one day doesn't redraw the other 41.
const DayCell = memo(function DayCell({ k, c, cellH, dot, out, isToday, period: p, pred, logged, pain }: CellProps) {
  const d = parse(k);
  const pe = p ? periodEnd(p) : null;
  const isS = p && (k === p.start || d.getDay() === 1);
  const isE = p && (k === pe || d.getDay() === 0);
  const isPred = !p && pred;
  const label = `${fmtLong(k)}${isToday ? ", hoy" : ""}${p ? ", regla" : isPred ? ", previsión" : ""}${logged ? ", con registro" : ""}`;
  return (
    <Pressable onPress={() => { tap(); router.push(`/day/${k}`); }} accessibilityRole="button" accessibilityLabel={label}
      android_ripple={{ color: c.accentSoft, borderless: true, radius: dot / 2 + 2 }}
      style={({ pressed }) => ({ width: `${100 / 7}%`, height: cellH, alignItems: "center", justifyContent: "center",
        opacity: out ? 0.35 : pressed ? 0.6 : 1 })}>
      {p && (
        // the period as one pastel band across its days, rounded at its ends like a petal
        <View style={{ position: "absolute", top: "10%", bottom: "10%", left: isS ? "8%" : 0, right: isE ? "8%" : 0, backgroundColor: c.period,
          borderTopLeftRadius: isS ? 999 : 0, borderBottomLeftRadius: isS ? 999 : 0,
          borderTopRightRadius: isE ? 999 : 0, borderBottomRightRadius: isE ? 999 : 0 }} />
      )}
      <View style={{ width: dot, height: dot, borderRadius: dot / 2, alignItems: "center", justifyContent: "center",
        backgroundColor: isPred ? c.pred : "transparent",
        borderWidth: isToday ? 2.5 : isPred ? 1.5 : 0,
        borderColor: isToday ? c.accent : c.period, borderStyle: isPred && !isToday ? "dashed" : "solid" }}>
        <Text maxFontSizeMultiplier={1.2} style={[tight, { fontFamily: isToday ? font.display : font.bold, fontSize: Math.min(17, dot * 0.4),
          color: p ? c.onPeriod : isToday || isPred ? c.accent : c.ink }]}>{d.getDate()}</Text>
      </View>
      {logged ? <View style={{ position: "absolute", bottom: (cellH - dot) / 2 + Math.max(3, dot * 0.1), width: 5, height: 5, borderRadius: 3,
        backgroundColor: p ? c.onPeriod : pain != null ? painColor(c, Math.max(1, pain)) : c.accent }} /> : null}
    </Pressable>
  );
});

export default function Calendar() {
  const c = useTheme();
  const L = useLayout();
  const { S, pred } = useStore();
  const T = today();
  const now = new Date();
  const [m, setM] = useState(() => ({ y: now.getFullYear(), m: now.getMonth() }));
  const [dir, setDir] = useState(0);
  const drag = useSharedValue(0);
  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateX: drag.value }] }));
  const calMax = L.xwide ? 760 : L.wide ? 600 : 620;
  const cardPad = L.compact ? 15 : L.tablet ? 22 : 18;
  const calW = Math.min(L.wide ? (L.inner - L.gap) * 0.6 : L.inner, calMax) - cardPad * 2 - 2;
  const cellW = calW / 7;
  const cellH = L.short ? Math.max(40, cellW / 1.9) : cellW; // flatter rows on a phone in landscape
  const dot = Math.max(28, Math.min(L.tablet ? 64 : 52, Math.min(cellW, cellH) * 0.8));
  const isNow = m.y === now.getFullYear() && m.m === now.getMonth();

  const go = (dir: number) => {
    select();
    setDir(dir);
    drag.value = 0;
    setM((v) => { const d = new Date(v.y, v.m + dir, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  };
  const goNow = () => { select(); setDir(0); setM({ y: now.getFullYear(), m: now.getMonth() }); };

  // Swipe left/right on the month to change it.
  const goRef = useRef(go);
  goRef.current = go;
  const pan = useRef(PanResponder.create({
    // Capture so a horizontal drag wins over the day buttons underneath the finger.
    onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderTerminationRequest: () => false,
    onPanResponderMove: (_, g) => { drag.value = g.dx * 0.35; },
    onPanResponderRelease: (_, g) => {
      if (g.dx < -50) goRef.current(1);
      else if (g.dx > 50) goRef.current(-1);
      else drag.value = withSpring(0, motion.settle);
    },
    onPanResponderTerminate: () => { drag.value = withSpring(0, motion.settle); },
  })).current;

  // Grid days and the period days in view, worked out once per month/data change.
  const { cells, periods, monthStart, monthEnd } = useMemo(() => {
    const first = new Date(m.y, m.m, 1);
    const start = key(new Date(m.y, m.m, 1 - ((first.getDay() + 6) % 7)));
    const cells: string[] = [];
    for (let i = 0; i < 42; i++) {
      const k = add(start, i);
      if (i >= 35 && parse(k).getMonth() !== m.m) break;
      cells.push(k);
    }
    return { cells, periods: periodDays(S, cells[0], cells[cells.length - 1]),
      monthStart: key(first), monthEnd: key(new Date(m.y, m.m + 1, 0)) };
  }, [m, S.periods]);

  const calendar = (
    <Card level={2} delay={0} style={{ width: "100%", maxWidth: calMax, alignSelf: "center", overflow: "hidden" }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <IconBtn icon="chevron-back" label="Mes anterior" onPress={() => go(-1)} />
        <Animated.Text key={`${m.y}-${m.m}`} entering={FadeIn.duration(motion.fast)} accessibilityRole="header" maxFontSizeMultiplier={1.3}
          style={[tight, { fontFamily: font.display, fontSize: L.fs(21), color: c.ink, textTransform: "capitalize" }]}>{MESL[m.m]} {m.y}</Animated.Text>
        <IconBtn icon="chevron-forward" label="Mes siguiente" onPress={() => go(1)} />
      </View>

      <View style={{ flexDirection: "row", borderRadius: 999, paddingVertical: 6, ...sunken(c) }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
          <Text key={d} style={{ flex: 1, textAlign: "center", fontFamily: font.bold, fontSize: L.fs(11), color: c.muted }}>{d}</Text>
        ))}
      </View>

      <Animated.View {...pan.panHandlers} style={dragStyle}>
      <Animated.View key={`${m.y}-${m.m}`} entering={dir > 0 ? FadeInRight.duration(motion.base).easing(motion.ease) : dir < 0 ? FadeInLeft.duration(motion.base).easing(motion.ease) : FadeIn.duration(motion.fast)}
        style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 4 }}>
        {cells.map((k) => {
          const log = S.days[k];
          return (
            <DayCell key={k} k={k} c={c} cellH={cellH} dot={dot} out={parse(k).getMonth() !== m.m} isToday={k === T}
              period={periods.get(k)} pred={pred.has(k)} logged={hasLog(log)} pain={log?.pain ?? null} />
          );
        })}
      </Animated.View>
      </Animated.View>

      <View style={{ flexDirection: "row", gap: 16, flexWrap: "wrap", paddingTop: 4 }}>
        <Legend c={c} kind="period" label="Regla" />
        <Legend c={c} kind="pred" label="Previsión" />
        <Legend c={c} kind="today" label="Hoy" />
        <Legend c={c} kind="log" label="Registro" />
      </View>
    </Card>
  );

  return (
    <Screen title="Calendario" right={isNow ? null : <Btn small variant="glass" icon="today-outline" label="Hoy" onPress={goNow} />}>
      <Columns ratio={1.5} left={calendar} right={<MonthSummary c={c} from={monthStart} to={monthEnd} />} />
    </Screen>
  );
}

/** What happened in the month on screen, in a few short lines. */
function MonthSummary({ c, from, to }: { c: Palette; from: string; to: string }) {
  const { S, pred } = useStore();
  const rows = useMemo(() => {
    const out: { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string }[] = [];
    for (const p of S.periods) {
      const e = periodEnd(p);
      if (e < from || p.start > to) continue;
      out.push({ icon: "water", title: `Regla · ${fmt(p.start)} – ${p.end ? fmt(p.end) : "en curso"}`,
        sub: p.end ? `${diff(p.start, p.end) + 1} días` : `Día ${diff(p.start, today()) + 1}` });
    }
    const pd = [...pred].filter((k) => k >= from && k <= to).sort();
    if (pd.length) out.push({ icon: "ellipse-outline", title: `Previsión · ${fmt(pd[0])} – ${fmt(pd[pd.length - 1])}`, sub: "Según tus ciclos" });
    const logged = Object.entries(S.days).filter(([k, d]) => k >= from && k <= to && hasLog(d)).length;
    if (logged) out.push({ icon: "create-outline", title: `${logged} ${logged === 1 ? "día" : "días"} con registro`, sub: "Dolor, síntomas o ánimo" });
    return out;
  }, [S, pred, from, to]);

  return (
    <Card level={1} delay={60}>
      <CardHead icon="sparkles" tone="peach" title="Este mes" />
      {rows.length === 0 ? (
        <Text style={{ fontFamily: font.body, fontSize: 14, color: c.muted }}>Sin registros. Toca un día para empezar.</Text>
      ) : rows.map((r) => (
        <View key={r.title} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <Badge icon={r.icon} size={34} tone={r.icon === "water" ? "pink" : r.icon === "ellipse-outline" ? "lilac" : "mint"} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: font.bold, fontSize: 14, color: c.ink }}>{r.title}</Text>
            <Text style={{ fontFamily: font.body, fontSize: 12, color: c.muted }}>{r.sub}</Text>
          </View>
        </View>
      ))}
      <Text style={{ fontFamily: font.body, fontSize: 12, color: c.muted, paddingTop: 2 }}>Desliza el calendario para cambiar de mes.</Text>
    </Card>
  );
}

function Legend({ c, kind, label }: { c: Palette; kind: "period" | "pred" | "log" | "today"; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <Svg width={16} height={16}>
        {kind === "period" && <Circle cx={8} cy={8} r={7} fill={c.period} />}
        {kind === "today" && <Circle cx={8} cy={8} r={6.5} fill="none" stroke={c.accent} strokeWidth={2} />}
        {kind === "pred" && <Circle cx={8} cy={8} r={6.5} fill={c.pred} stroke={c.period} strokeWidth={1.5} strokeDasharray="2.5 2" />}
        {kind === "log" && <Circle cx={8} cy={8} r={3} fill={c.accent} />}
      </Svg>
      <Text style={{ fontFamily: font.bold, fontSize: 12, color: c.muted }}>{label}</Text>
    </View>
  );
}
