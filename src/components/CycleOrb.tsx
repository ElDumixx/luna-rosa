// The cycle as a ring of four pastel arcs, one per phase (period, follicular, ovulation, luteal), on a white disc.
// The days already lived are drawn full strength, the rest faded; a dot marks today and the center shows the day.
// Plain SVG paths, redrawn only when the day or the cycle changes. Two light touches of life, both on the UI thread:
// the ring swings into place when it appears, and a soft ring keeps pulsing out from today's dot.
import React, { memo, useEffect } from "react";
import { Text, View } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSpring, withTiming } from "react-native-reanimated";
import Svg, { Circle, G, Path } from "react-native-svg";
import { PHASE_TEXT, PhaseId } from "../cycle";
import { alpha, bloom, font, Palette, raised, tight, useTheme, webGlass } from "../theme";

const ACircle = Animated.createAnimatedComponent(Circle);

/** Arc from fraction `a` to `b` of the circle, clockwise from 12 o'clock. */
function arc(cx: number, r: number, a: number, b: number) {
  const pt = (f: number) => { const t = -Math.PI / 2 + f * 2 * Math.PI; return `${(cx + r * Math.cos(t)).toFixed(2)} ${(cx + r * Math.sin(t)).toFixed(2)}`; };
  if (b - a >= 0.999) return `M ${pt(a)} A ${r} ${r} 0 1 1 ${pt(a + 0.5)} A ${r} ${r} 0 1 1 ${pt(a)}`;
  return `M ${pt(a)} A ${r} ${r} 0 ${b - a > 0.5 ? 1 : 0} 1 ${pt(b)}`;
}

/** Same split as `phases` in src/cycle.ts: ovulation ~14 days before the next period, not on day 14. */
function segments(len: number, dur: number): { id: PhaseId; from: number; to: number }[] {
  const d = Math.min(dur, len - 6), ov = Math.max(d + 3, len - 14);
  return ([
    { id: "period", from: 1, to: d }, { id: "follicular", from: d + 1, to: ov - 2 },
    { id: "ovulation", from: ov - 1, to: ov + 1 }, { id: "luteal", from: ov + 2, to: len },
  ] as { id: PhaseId; from: number; to: number }[]).filter((s) => s.to >= s.from);
}

export const CycleOrb = memo(function CycleOrb({ day, len, dur, size = 220, learned = true }: { day: number | null; len: number; dur: number; size?: number; learned?: boolean }) {
  const c = useTheme();
  const sw = Math.round(size * 0.085);
  const mid = size / 2, R = mid - sw / 2 - 4;
  const today = day ? Math.min(day, len) : 0;
  const gap = 0.012; // a small gap between the phase arcs
  const segs = learned ? segments(len, dur) : [{ id: "period" as PhaseId, from: 1, to: len }];
  const current = day ? segs.find((s) => today >= s.from && today <= s.to)?.id ?? "luteal" : null;
  const tColor = (id: PhaseId) => (learned ? c.phase[id] : c.pink);
  const t = -Math.PI / 2 + ((today - 0.5) / len) * 2 * Math.PI;
  const inner = size - sw * 2 - 22;
  const m = sw; // room for the pulse

  const reduced = useReducedMotion();
  const swing = useSharedValue(reduced ? 1 : 0);
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    swing.value = withSpring(1, { damping: 16, stiffness: 90 });
    pulse.value = withDelay(600, withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1));
    return () => cancelAnimation(pulse);
  }, [reduced]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.3 + swing.value * 0.7, transform: [{ rotate: `${(1 - swing.value) * -70}deg` }, { scale: 0.88 + swing.value * 0.12 }] }));
  const halo = useAnimatedProps(() => ({ r: sw * (0.75 + pulse.value * 0.9), opacity: 0.5 * (1 - pulse.value) }));

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }} accessible
      accessibilityLabel={day ? `Día ${day} del ciclo${learned && current ? `, fase ${PHASE_TEXT[current].name}` : ""}` : "Aún sin datos del ciclo"}>
      <View style={{ position: "absolute", width: size, height: size, borderRadius: size / 2, ...raised(c, 2) }} />
      {/* the SVG gets a margin around the ring so today's pulse isn't clipped at its edge */}
      <Animated.View style={[{ position: "absolute", left: -m, top: -m, width: size + m * 2, height: size + m * 2 }, ring]}>
      <Svg width={size + m * 2} height={size + m * 2}>
      <G transform={`translate(${m} ${m})`}>
        {segs.map((s) => {
          const a = (s.from - 1) / len + gap / 2, b = s.to / len - gap / 2;
          const lived = Math.min(b, Math.max(a, today / len));
          return (
            <React.Fragment key={s.id}>
              <Path d={arc(mid, R, a, b)} stroke={tColor(s.id)} strokeOpacity={0.35} strokeWidth={sw} strokeLinecap="round" fill="none" />
              {day && lived > a && <Path d={arc(mid, R, a, lived)} stroke={tColor(s.id)} strokeWidth={sw} strokeLinecap="round" fill="none" />}
            </React.Fragment>
          );
        })}
        {day ? <ACircle animatedProps={halo} cx={mid + R * Math.cos(t)} cy={mid + R * Math.sin(t)} fill={c.accent} /> : null}
        {day ? <Circle cx={mid + R * Math.cos(t)} cy={mid + R * Math.sin(t)} r={sw * 0.72} fill={c.solid} stroke={c.accent} strokeWidth={sw * 0.34} /> : null}
      </G>
      </Svg>
      </Animated.View>
      <View style={{ width: inner, height: inner, borderRadius: inner / 2, alignItems: "center", justifyContent: "center", backgroundColor: webGlass ? alpha(c.soft, 0.3) : c.soft }}>
        {day ? (
          <>
            <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: font.bold, fontSize: Math.max(12, size * 0.056), color: c.muted }}>Día</Text>
            <Animated.Text key={day} entering={bloom(150)} maxFontSizeMultiplier={1}
              style={[tight, { fontFamily: font.display, fontSize: size * 0.29, lineHeight: size * 0.34, color: c.ink, letterSpacing: -1 }]}>{day}</Animated.Text>
            {learned && current ? <PhasePill c={c} id={current} size={size} /> :
              <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: font.bold, fontSize: Math.max(12, size * 0.056), color: c.muted }}>de tu ciclo</Text>}
          </>
        ) : (
          <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: font.bold, fontSize: 15, color: c.muted, textAlign: "center" }}>Sin datos{"\n"}todavía</Text>
        )}
      </View>
    </View>
  );
});

function PhasePill({ c, id, size }: { c: Palette; id: PhaseId; size: number }) {
  return (
    <View style={{ marginTop: 4, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: c.phase[id] }}>
      <Text maxFontSizeMultiplier={1.2} style={{ fontFamily: font.bold, fontSize: Math.max(11, size * 0.05), color: c.scheme === "dark" ? c.onPeriod : c.phaseDeep[id] }}>
        {PHASE_TEXT[id].name.replace(" (aprox.)", "")}
      </Text>
    </View>
  );
}
