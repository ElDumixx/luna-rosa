import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Screen } from "../../src/components/Screen";
import { Badge } from "../../src/components/ui";
import { TIPS } from "../../src/content";
import { CycleInfo } from "../../src/cycle";
import { tap } from "../../src/feedback";
import { useStore } from "../../src/store";
import { enter, font, motion, Palette, raised, Tone, useLayout, useTheme } from "../../src/theme";

type IconName = keyof typeof Ionicons.glyphMap;
const ICON: Record<string, IconName> = { normal: "analytics", dolor: "medkit", irreg: "swap-horizontal", antojos: "ice-cream", hierro: "water", consulta: "chatbubbles" };
const TONE: Record<string, Tone> = { normal: "lilac", dolor: "pink", irreg: "peach", antojos: "peach", hierro: "pink", consulta: "mint" };

export default function Guide() {
  const c = useTheme();
  const L = useLayout();
  const { ci } = useStore();
  const [open, setOpen] = useState<string | null>(null);

  // Cards that match what the user records move to the top.
  const first: string[] = [];
  if (ci.pain != null && ci.pain >= 1.5) first.push("dolor");
  if (ci.recent.some((v) => v > 35 || v < 21)) first.push("irreg");
  const tips = [...TIPS.filter((t) => first.includes(t.id)), ...TIPS.filter((t) => !first.includes(t.id))];
  // one column on phones, two on tablets in portrait, three on iPad landscape
  const cols = L.xwide ? 3 : L.wide ? 2 : 1;
  const colW = cols > 1 ? Math.floor((L.inner - L.gap * (cols - 1)) / cols) : undefined;

  return (
    <Screen title="Guía" label="Breve y con base científica">
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: L.gap, alignItems: "flex-start" }}>
        {tips.map((t, i) => (
          <TipCard key={t.id} c={c} t={t} i={i} w={colW} mine={first.includes(t.id)} isOpen={open === t.id} ci={ci}
            onToggle={() => { tap(); setOpen(open === t.id ? null : t.id); }} />
        ))}
      </View>
    </Screen>
  );
}

function TipCard({ c, t, i, w, mine, isOpen, onToggle, ci }: {
  c: Palette; t: (typeof TIPS)[number]; i: number; w?: number; mine: boolean; isOpen: boolean; onToggle: () => void; ci: CycleInfo;
}) {
  const L = useLayout();
  const rot = useSharedValue(0);
  useEffect(() => { rot.value = withTiming(isOpen ? 1 : 0, { duration: motion.base, easing: motion.ease }); }, [isOpen]);
  const chev = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value * 180}deg` }] }));
  const pos = (v: number) => `${((v - 15) / 30) * 100}%` as const;
  return (
    <Animated.View entering={enter(i * 30)} layout={LinearTransition.duration(motion.base).easing(motion.ease)}
      style={[{ width: w ?? "100%", borderRadius: L.radius, overflow: "hidden" }, raised(c, isOpen ? 2 : 1)]}>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: isOpen }}
        accessibilityHint={isOpen ? "Ocultar detalles" : "Ver más detalles"} android_ripple={{ color: c.accentSoft }}
        style={{ padding: L.compact ? 15 : L.tablet ? 22 : 18, gap: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Badge icon={ICON[t.id] ?? "book"} tone={TONE[t.id] ?? "pink"} size={L.fs(44)} />
          <View style={{ flex: 1 }}>
            {mine && <Text style={{ fontFamily: font.bold, fontSize: 11, color: c.accent }}>Según tus registros</Text>}
            <Text style={{ fontFamily: font.display, fontSize: L.fs(20), color: c.ink }}>{t.t}</Text>
          </View>
          <Animated.View style={[{ width: 30, height: 30, borderRadius: 15, backgroundColor: c.accentSoft, alignItems: "center", justifyContent: "center" }, chev]}>
            <Ionicons name="chevron-down" size={16} color={c.accent} />
          </Animated.View>
        </View>
        <Text style={{ fontFamily: font.body, fontSize: L.fs(15), lineHeight: L.fs(22), color: c.ink }}>{t.s}</Text>
        {t.range && (
          <View style={{ gap: 4 }} accessible accessibilityLabel={`Rango habitual de 21 a 35 días${ci.typical ? `. Tu rango: ${ci.lo} a ${ci.hi} días` : ""}`}>
            <View style={{ height: 30 }}>
              <View style={{ position: "absolute", top: 10, left: 0, right: 0, height: 10, borderRadius: 9, backgroundColor: c.soft }} />
              <View style={{ position: "absolute", top: 10, left: pos(21), width: `${(14 / 30) * 100}%`, height: 10, borderRadius: 9, backgroundColor: c.period }} />
              {ci.lo != null && ci.hi != null && (
                <View style={{ position: "absolute", top: 6, left: pos(ci.lo), width: `${Math.max(2, ((ci.hi - ci.lo) / 30) * 100)}%`, height: 18,
                  borderRadius: 9, backgroundColor: c.accent, borderWidth: 3, borderColor: c.solid }} />
              )}
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              {["15", "21", "28", "35", "45 días"].map((l) => <Text key={l} style={{ fontFamily: font.bold, fontSize: 11, color: c.muted }}>{l}</Text>)}
            </View>
            {ci.typical && <Text style={{ fontFamily: font.bold, color: c.accent }}>Tu rango: {ci.lo}–{ci.hi} días.</Text>}
          </View>
        )}
        {isOpen && (
          <Animated.View entering={FadeIn.duration(motion.base).delay(60)} style={{ gap: 10, paddingTop: 2 }}>
            {t.more.map((m) => (
              <View key={m} style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.accent, marginTop: 7 }} />
                <Text style={{ flex: 1, fontFamily: font.body, fontSize: L.fs(14), lineHeight: L.fs(20), color: c.ink }}>{m}</Text>
              </View>
            ))}
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
}
