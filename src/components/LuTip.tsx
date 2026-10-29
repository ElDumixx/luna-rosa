// Lu peeking in on the Today screen: a short line for the current phase and a question she can answer.
// Tapping it opens the Lu tab and asks that question right away.
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import React from "react";
import { Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { CycleInfo, PhaseId, phases } from "../cycle";
import { alpha, font, pop, petal, raised, useLayout, useTheme } from "../theme";
import { Lu } from "./Lu";
import { Press } from "./ui";

export type TipKey = PhaseId | "learning" | "none";
const TIPS: Record<TipKey, { line: string; q: string }> = {
  period: { line: "Si hoy te duele, calor y moverte suave suelen ayudar.", q: "¿Cómo alivio el dolor?" },
  follicular: { line: "Suben los estrógenos: muchas notan más energía estos días.", q: "¿En qué fase estoy?" },
  ovulation: { line: "Estos días es normal notar más flujo, claro y elástico.", q: "¿Es normal mi flujo?" },
  luteal: { line: "¿Más hambre o sensibilidad? Es la progesterona, y es normal.", q: "¿Por qué tengo antojos?" },
  learning: { line: "Con otra regla más aprendo tu ciclo. Mientras, pregúntame lo que quieras.", q: "¿Es normal mi ciclo?" },
  none: { line: "Cuéntame cuándo empezó tu última regla y te ayudo a llevarla.", q: "¿Cuándo me baja?" },
};

/** `onPeriod`: a period is going on now (its tip applies even before the cycle is learned). */
export function LuTip({ ci, onPeriod, delay = 0 }: { ci: CycleInfo; onPeriod?: boolean; delay?: number }) {
  const c = useTheme();
  const L = useLayout();
  const tip = TIPS[onPeriod ? "period" : phases(ci)?.current ?? (ci.last ? "learning" : "none")];
  return (
    <Animated.View entering={pop(delay)}>
      <Press onPress={() => router.navigate({ pathname: "/assistant", params: { q: tip.q } })} scaleTo={0.98}
        accessibilityLabel={`Lu: ${tip.line} Preguntar: ${tip.q}`}
        style={[{ flexDirection: "row", alignItems: "center", gap: 12, padding: L.compact ? 12 : 14, paddingRight: 16 }, raised(c, 1), petal(L.radius, 0.35),
          { backgroundImage: `linear-gradient(120deg, ${alpha(c.pink, c.scheme === "dark" ? 0.16 : 0.32)}, ${c.surface} 60%)` }]}>
        <View style={{ width: L.fs(58), height: L.fs(58), borderRadius: L.fs(29), alignItems: "center", justifyContent: "center", backgroundColor: c.tint.pink }}>
          <Lu size={L.fs(50)} />
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={{ fontFamily: font.body, fontSize: L.fs(14), lineHeight: L.fs(20), color: c.ink }}>
            <Text style={{ fontFamily: font.bold, color: c.accent }}>Lu · </Text>{tip.line}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={{ fontFamily: font.bold, fontSize: L.fs(13), color: c.accent }}>{tip.q}</Text>
            <Ionicons name="arrow-forward" size={14} color={c.accent} />
          </View>
        </View>
      </Press>
    </Animated.View>
  );
}
