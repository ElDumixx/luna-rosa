// Seven days around today at a glance: period, predicted days, today (ringed) and days with a log.
import { router } from "expo-router";
import React, { memo, useMemo } from "react";
import { Pressable, Text, View } from "react-native";
import { hasLog, periodDays } from "../cycle";
import { add, fmtLong, parse, today } from "../dates";
import { tap } from "../feedback";
import { useStore } from "../store";
import { font, Palette, petal, tight, useLayout, useTheme } from "../theme";
import { Card, CardHead } from "./ui";

const LETTER = ["D", "L", "M", "X", "J", "V", "S"];

const WeekDay = memo(function WeekDay({ k, c, isToday, period, pred, logged, dot }: {
  k: string; c: Palette; isToday: boolean; period: boolean; pred: boolean; logged: boolean; dot: number;
}) {
  const d = parse(k);
  const label = `${fmtLong(k)}${isToday ? ", hoy" : ""}${period ? ", regla" : pred ? ", previsión" : ""}${logged ? ", con registro" : ""}`;
  return (
    <Pressable onPress={() => { tap(); router.push(`/day/${k}`); }} accessibilityRole="button" accessibilityLabel={label}
      android_ripple={{ color: c.accentSoft, borderless: true, radius: dot / 2 + 4 }}
      style={({ pressed }) => ({ flex: 1, alignItems: "center", gap: 6, opacity: pressed ? 0.6 : 1 })}>
      <Text style={{ fontFamily: font.bold, fontSize: 11, color: isToday ? c.accent : c.muted }}>{LETTER[d.getDay()]}</Text>
      {/* each day is a petal-shaped pebble: pastel pink for the period, dashed for a predicted day, outlined for today */}
      <View style={{ width: dot, height: dot, ...petal(dot * 0.42, 0.45), alignItems: "center", justifyContent: "center",
        backgroundColor: period ? c.period : pred ? c.pred : c.soft,
        borderWidth: isToday ? 2.5 : pred && !period ? 1.5 : 0, borderColor: isToday ? c.accent : c.period, borderStyle: pred && !period && !isToday ? "dashed" : "solid" }}>
        <Text maxFontSizeMultiplier={1.2} style={[tight, { fontFamily: font.display, fontSize: dot * 0.4, color: period ? c.onPeriod : isToday ? c.accent : c.ink }]}>{d.getDate()}</Text>
      </View>
      <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: logged ? c.accent : "transparent" }} />
    </Pressable>
  );
});

export function WeekStrip({ delay }: { delay?: number }) {
  const c = useTheme();
  const L = useLayout();
  const dot = L.compact ? 34 : L.fs(38);
  const { S, pred } = useStore();
  const T = today();
  const from = add(T, -3);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => add(from, i)), [from]);
  const periods = useMemo(() => periodDays(S, from, add(T, 3)), [S.periods, from]);
  return (
    <Card delay={delay} style={{ paddingVertical: 14, gap: 10 }}>
      <CardHead icon="calendar" tone="lilac" title="Esta semana" right={
        <Pressable hitSlop={8} onPress={() => { tap(); router.navigate("/calendar"); }} accessibilityRole="link">
          <Text style={{ fontFamily: font.bold, fontSize: L.fs(13), color: c.accent }}>Ver mes</Text>
        </Pressable>} />
      <View style={{ flexDirection: "row" }}>
        {days.map((k) => (
          <WeekDay key={k} k={k} c={c} dot={dot} isToday={k === T} period={periods.has(k)} pred={pred.has(k)} logged={hasLog(S.days[k])} />
        ))}
      </View>
    </Card>
  );
}
