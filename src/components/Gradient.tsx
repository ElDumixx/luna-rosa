// Native gradients (backgroundImage) and the soft, slowly drifting pastel page behind every screen.
import React, { useEffect } from "react";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { StyleSheet, View, ViewStyle } from "react-native";
import { alpha, useLayout, useTheme, webGlass } from "../theme";

const DIR = { diag: "135deg", down: "180deg", right: "90deg" } as const;
export const linear = (colors: string[], angle: keyof typeof DIR = "diag") => `linear-gradient(${DIR[angle]}, ${colors.join(", ")})`;

/** Fills its parent with a gradient. Put it first inside a view with overflow hidden. */
export function GradientFill({ colors, angle = "diag" }: { colors: string[]; angle?: keyof typeof DIR }) {
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundImage: linear(colors, angle) }]} />;
}

/** View with a gradient background. */
export function Gradient({ colors, style, children, angle = "diag" }: { colors: string[]; style?: ViewStyle | ViewStyle[]; children?: React.ReactNode; angle?: keyof typeof DIR }) {
  return <View style={[style as ViewStyle, { backgroundImage: linear(colors, angle) }]}>{children}</View>;
}

/**
 * A flat pastel disc that drifts very slowly in a small loop: the page feels alive without drawing attention.
 * Plain fill moved by a transform on the UI thread, so it costs almost nothing; still with Reduce Motion.
 */
function Disc({ color, size, x, y, dx, dy, ms }: { color: string; size: number; x: number; y: number; dx: number; dy: number; ms: number }) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    t.value = withRepeat(withTiming(1, { duration: ms, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(t);
  }, [reduced, ms]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateX: t.value * dx }, { translateY: t.value * dy }, { scale: 1 + t.value * 0.06 }] }));
  return <Animated.View pointerEvents="none" style={[{ position: "absolute", left: x - size / 2, top: y - size / 2, width: size, height: size, borderRadius: size / 2, backgroundColor: color }, st]} />;
}

/**
 * The page behind every screen: blush paper with a pink wash at the top and three pastel discs (pink, lilac and
 * peach) peeking in from the edges, drifting slowly.
 */
export function Backdrop() {
  const c = useTheme();
  const { width, height } = useLayout();
  const big = Math.min(Math.max(width, height) * 0.7, Math.min(width, height) * 1.1);
  const dark = c.scheme === "dark";
  // On the web the cards are glass: the discs are stronger there, so the glass has color to bend and blur.
  const k = webGlass ? (dark ? 1.8 : 1.7) : 1;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: c.bg, overflow: "hidden",
      backgroundImage: `linear-gradient(180deg, ${dark ? "#24131C" : "#FDE6EE"}, ${c.bg} 38%, ${c.bg} 80%, ${dark ? "#1A1220" : "#F6EEFF"})` }]}>
      <Disc color={alpha(c.pink, (dark ? 0.1 : 0.32) * k)} size={big} x={width * 1.02} y={-big * 0.12} dx={-width * 0.08} dy={height * 0.04} ms={9000} />
      <Disc color={alpha(c.phase.follicular, (dark ? 0.06 : 0.22) * k)} size={big * 0.45} x={-big * 0.05} y={height * 0.42} dx={width * 0.1} dy={-height * 0.05} ms={11000} />
      {webGlass && <Disc color={alpha(c.phase.luteal, dark ? 0.12 : 0.3)} size={big * 0.5} x={width * 0.95} y={height * 0.62} dx={-width * 0.12} dy={height * 0.04} ms={15000} />}
      <Disc color={alpha(c.accent2, (dark ? 0.08 : 0.1) * (webGlass ? 2.4 : 1))} size={big * 0.9} x={-big * 0.08} y={height * 0.96} dx={width * 0.07} dy={-height * 0.03} ms={13000} />
    </View>
  );
}
