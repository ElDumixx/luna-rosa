// Approximate cycle phases as a bar, with a marker on today.
import React, { useState } from "react";
import { Text, View } from "react-native";
import Animated, { useAnimatedStyle, withTiming } from "react-native-reanimated";
import { CycleInfo, PHASE_TEXT, phases } from "../cycle";
import { font, motion, sunken, useLayout, useTheme } from "../theme";
import { Card, CardHead } from "./ui";

export function PhaseBar({ ci, delay }: { ci: CycleInfo; delay?: number }) {
  const c = useTheme();
  const L = useLayout();
  const [w, setW] = useState(0);
  const ph = phases(ci);
  const x = ph ? (Math.min(ph.day, ph.len) - 0.5) / ph.len * w : 0;
  const marker = useAnimatedStyle(() => ({ transform: [{ translateX: withTiming(x - 9, { duration: motion.slow, easing: motion.ease }) }] }));
  if (!ph) {
    return (
      <Card delay={delay}>
        <CardHead icon="moon" tone="peach" title="Tus fases" />
        <Text style={{ fontFamily: font.body, fontSize: L.fs(14), color: c.muted }}>Cuando registres dos reglas verás aquí tus fases aproximadas.</Text>
      </Card>
    );
  }
  const cur = PHASE_TEXT[ph.current];
  return (
    <Card delay={delay}>
      <CardHead icon="moon" tone="peach" title="Tu fase" right={
        <Text style={{ fontFamily: font.bold, fontSize: L.fs(12), color: c.muted }}>{ph.late ? "Ciclo más largo" : `Día ${ph.day} de ~${ph.len}`}</Text>} />
      <Text style={{ fontFamily: font.display, fontSize: L.fs(22), color: c.phaseDeep[ph.current] }}>{cur.name}</Text>
      <Text style={{ fontFamily: font.body, fontSize: L.fs(14), lineHeight: L.fs(20), color: c.muted }}>{cur.text}</Text>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ height: 30, justifyContent: "center", marginTop: 4 }}
        accessible accessibilityLabel={`Fase actual: ${cur.name}`}>
        <View style={{ flexDirection: "row", height: 16, borderRadius: 8, overflow: "hidden", gap: 3, padding: 2, ...sunken(c) }}>
          {ph.seg.map((s) => (
            <View key={s.id} style={{ flex: s.to - s.from + 1, borderRadius: 6, backgroundColor: c.phase[s.id], opacity: s.id === ph.current ? 1 : 0.5 }} />
          ))}
        </View>
        {w > 0 && (
          <Animated.View style={[{ position: "absolute", left: 0, width: 18, height: 18, borderRadius: 9, backgroundColor: c.solid,
            borderWidth: 4, borderColor: c.accent }, marker]} />
        )}
      </View>
      <View style={{ flexDirection: "row", gap: 2 }}>
        {ph.seg.map((s) => (
          <Text key={s.id} numberOfLines={1} style={{ flex: s.to - s.from + 1, fontFamily: font.bold, fontSize: L.fs(10), color: s.id === ph.current ? c.ink : c.faint }}>
            {s.to - s.from >= 2 ? PHASE_TEXT[s.id].name.replace(" (aprox.)", "") : ""}
          </Text>
        ))}
      </View>
    </Card>
  );
}
