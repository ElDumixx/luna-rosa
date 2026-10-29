// Opening screen while data loads. It starts exactly like the system launch screen (the same pearl, centered,
// on the same color), then the aurora fades in, the pearl rises with a soft halo and the quote of the day appears.
// On exit the pearl swells slightly and everything fades, revealing the app. Tap to skip.
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { MESL } from "../dates";
import { quoteOfDay } from "../content";
import { alpha, font, useLayout, useTheme } from "../theme";
import { Backdrop } from "./Gradient";

// Size of the launch image as the system draws it: Android 12+ fits the icon in 288 dp, iOS uses imageWidth (app.config.ts).
const LOGO = Platform.OS === "android" ? 288 : 200;
const PEARL = LOGO * 0.64; // the visible pearl inside the transparent image
const ease = Easing.out(Easing.cubic);
/** The system launch screen fades out over this long once hidden (set in app/_layout.tsx). */
export const NATIVE_FADE_MS = 220;

/** `onShown` fires once the system launch screen has gone and this one is what people see. */
export function Splash({ visible, appDrawn, onSkip, onShown }: { visible: boolean; appDrawn: boolean; onSkip: () => void; onShown: () => void }) {
  const c = useTheme();
  const L = useLayout();
  const [gone, setGone] = useState(false);
  const d = new Date();
  const intro = useSharedValue(0); // 0 = identical to the native launch screen, 1 = settled
  const out = useSharedValue(0);   // 0 → 1 while leaving

  // The system launch screen stays up until the app behind this one has drawn its first screen (the busiest moment),
  // so the intro below plays on an idle UI thread. This first frame is identical to the system screen: no jump.
  useEffect(() => {
    if (!appDrawn) return;
    let raf = requestAnimationFrame(() => (raf = requestAnimationFrame(() => {
      SplashScreen.hideAsync().catch(() => {}).finally(() => {
        intro.value = withDelay(NATIVE_FADE_MS, withTiming(1, { duration: 700, easing: ease }));
        onShown();
      });
    })));
    return () => cancelAnimationFrame(raf);
  }, [appDrawn]);
  useEffect(() => {
    if (!visible) out.value = withTiming(1, { duration: 360, easing: ease }, (done) => { if (done) runOnJS(setGone)(true); });
  }, [visible]);

  const rise = L.short ? 40 : 70;
  const root = useAnimatedStyle(() => ({ opacity: 1 - out.value }));
  const aurora = useAnimatedStyle(() => ({ opacity: intro.value }));
  const pearl = useAnimatedStyle(() => ({
    transform: [{ translateY: -rise * intro.value }, { scale: (1 - 0.12 * intro.value) * (1 + 0.1 * out.value) }],
  }));
  const halo = useAnimatedStyle(() => ({ opacity: intro.value * 0.9, transform: [{ scale: 0.8 + 0.2 * intro.value }] }));
  const words = useAnimatedStyle(() => {
    const t = Math.max(0, intro.value * 1.6 - 0.6); // starts once the pearl is halfway up
    return { opacity: t, transform: [{ translateY: 12 * (1 - t) - rise * intro.value + out.value * -6 }] };
  });

  if (gone) return null;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, { zIndex: 50, backgroundColor: c.scheme === "dark" ? "#150D12" : "#FFF7F9" }, root]}>
      <Animated.View style={[StyleSheet.absoluteFill, aurora]}><Backdrop /></Animated.View>
      <Pressable style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 30 }} onPress={onSkip}
        accessibilityRole="button" accessibilityLabel="Entrar en Luna Rosa">
        <Animated.View style={[{ width: LOGO, height: LOGO, alignItems: "center", justifyContent: "center" }, pearl]}>
          {/* halo: a colored glow and a thin lit ring around the pearl */}
          <Animated.View pointerEvents="none" style={[{ position: "absolute", width: PEARL * 1.9, height: PEARL * 1.9, borderRadius: PEARL,
            backgroundImage: `radial-gradient(circle closest-side, ${alpha(c.aurora[0], 0.55)}, ${alpha(c.aurora[2], 0.18)} 60%, ${alpha(c.aurora[2], 0)})` }, halo]} />
          <Animated.View pointerEvents="none" style={[{ position: "absolute", width: PEARL * 1.28, height: PEARL * 1.28, borderRadius: PEARL,
            borderWidth: 1, borderColor: c.edge, backgroundColor: alpha("#FFFFFF", c.scheme === "dark" ? 0.03 : 0.18),
            boxShadow: `0px 20px 40px -12px ${alpha(c.shadow, c.scheme === "dark" ? 0.5 : 0.22)}, inset 0px 1px 0px ${c.hi}` }, halo]} />
          <Image fadeDuration={0} source={require("../../assets/splash-icon.png")} style={{ width: LOGO, height: LOGO }} />
        </Animated.View>
        <Animated.View style={[{ position: "absolute", top: "50%", marginTop: LOGO * 0.44, left: 30, right: 30, alignItems: "center" }, words]}>
          <Text style={{ fontFamily: font.italic, fontSize: L.fs(34), color: c.accent, letterSpacing: -0.4 }}>Luna Rosa</Text>
          <View style={{ marginTop: 14, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={{ width: 18, height: 1, backgroundColor: c.faint }} />
            <Text style={{ fontFamily: font.bold, fontSize: L.fs(11), letterSpacing: 1.4, color: c.muted, textTransform: "uppercase" }}>
              Frase del {d.getDate()} de {MESL[d.getMonth()]}
            </Text>
            <View style={{ width: 18, height: 1, backgroundColor: c.faint }} />
          </View>
          <Text style={{ marginTop: 10, fontFamily: font.displayMed, fontSize: L.fs(20), lineHeight: L.fs(27), color: c.ink, textAlign: "center", maxWidth: 420, opacity: 0.88 }}>
            {quoteOfDay(d)}
          </Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

export const SPLASH_MIN_MS = NATIVE_FADE_MS + 1100; // long enough to read the quote, short enough not to wait
