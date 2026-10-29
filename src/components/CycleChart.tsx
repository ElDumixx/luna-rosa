// Last cycle lengths as bars that grow in, over the 21–35 day band, so "normal" is visible at a glance.
import React, { useEffect } from "react";
import { Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { font, motion, useTheme } from "../theme";

const Y0 = 15, Y1 = 45, H = 120;
const y = (v: number) => H * (1 - (v - Y0) / (Y1 - Y0));

function Bar({ v, i }: { v: number; i: number }) {
  const c = useTheme();
  const h = H - y(v);
  const g = useSharedValue(0);
  useEffect(() => { g.value = 0; g.value = withDelay(i * 40, withTiming(1, { duration: motion.slow, easing: motion.ease })); }, [v]);
  const st = useAnimatedStyle(() => ({ height: Math.max(0, h * g.value) }));
  const out = v < 21 || v > 35;
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", height: H }}>
      <Text style={{ fontFamily: font.bold, fontSize: 11, color: c.ink, marginBottom: 3 }}>{v}</Text>
      <Animated.View style={[{ width: "68%", maxWidth: 36, borderTopLeftRadius: 12, borderTopRightRadius: 12, borderBottomLeftRadius: 4, borderBottomRightRadius: 4,
        backgroundColor: out ? c.phase.ovulation : c.period }, st]} />
    </View>
  );
}

export function CycleChart({ lens }: { lens: number[] }) {
  const c = useTheme();
  const L = lens.slice(-6);
  if (!L.length) return <Text style={{ fontFamily: font.body, color: c.muted, fontSize: 14 }}>Aparece cuando registres 2 reglas.</Text>;
  return (
    <View style={{ flexDirection: "row", gap: 6 }} accessible accessibilityLabel={`Tus últimos ciclos: ${L.join(", ")} días. Rango habitual de 21 a 35.`}>
      <View style={{ width: 20, height: H }}>
        {[35, 28, 21].map((v) => (
          <Text key={v} style={{ position: "absolute", top: y(v) - 7, right: 0, fontFamily: font.bold, fontSize: 10, color: c.faint }}>{v}</Text>
        ))}
      </View>
      <View style={{ flex: 1, height: H }}>
        <View style={{ position: "absolute", left: 0, right: 0, top: y(35), height: y(21) - y(35), backgroundColor: c.soft, borderRadius: 10 }} />
        <View style={{ flexDirection: "row", flex: 1 }}>
          {L.map((v, i) => <Bar key={i} v={v} i={i} />)}
        </View>
      </View>
    </View>
  );
}
