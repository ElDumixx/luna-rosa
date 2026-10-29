// Screen scaffold over the shared aurora: a large title that fades as you scroll, and a
// compact glass bar that takes its place. Readable max width on tablets; room for the tab bar.
import React from "react";
import { Platform, Text, View } from "react-native";
import Animated, { interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { font, tight, useLayout, useTheme } from "../theme";
import { Glass } from "./Glass";
import { Label } from "./ui";

const ios = Platform.OS === "ios";

export function Screen({ title, label, right, children, brand }: { title?: string; label?: string; right?: React.ReactNode; children: React.ReactNode; brand?: boolean }) {
  const c = useTheme();
  const L = useLayout();
  const ins = useSafeAreaInsets();
  const y = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => { y.value = e.contentOffset.y + (e.contentInset?.top ?? 0); });
  const bigTitle = useAnimatedStyle(() => ({
    opacity: interpolate(y.value, [0, 70], [1, 0], "clamp"),
  }));
  const bar = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [50, 90], [0, 1], "clamp") }));

  return (
    <View style={{ flex: 1 }}>
      <Animated.ScrollView onScroll={onScroll} scrollEventThrottle={16} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
        // iOS native tabs: let UIKit inset the content for the status bar and the Liquid Glass tab bar.
        contentInsetAdjustmentBehavior={ios ? "automatic" : undefined}
        contentContainerStyle={{ paddingHorizontal: L.pad, paddingTop: ios ? (L.tablet ? 14 : 6) : ins.top + 10,
          paddingBottom: ios ? 36 : (L.short ? 90 : L.tablet ? 150 : 130), alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: L.max, gap: L.gap }}>
          {title ? <Animated.View style={bigTitle}><Header label={label} title={title} right={right} brand={brand} /></Animated.View> : null}
          {children}
        </View>
      </Animated.ScrollView>
      {title ? (
        <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 0, left: 0, right: 0, height: ins.top + 46 }, bar]}>
          <Glass strong style={{ flex: 1, borderRadius: 0, borderWidth: 0, justifyContent: "flex-end", alignItems: "center", paddingBottom: 12 }}>
            <Text style={{ fontFamily: brand ? font.italic : font.display, fontSize: L.fs(17), color: brand ? c.accent : c.ink }}>{title}</Text>
          </Glass>
        </Animated.View>
      ) : null}
    </View>
  );
}

/**
 * Columns that follow the window: stacked on phones, two side by side on wide screens (iPad portrait,
 * Android tablets, landscape), three on extra-wide ones (iPad landscape) when a `third` is given.
 */
export function Columns({ left, right, third, ratio = 1 }: { left: React.ReactNode; right: React.ReactNode; third?: React.ReactNode; ratio?: number }) {
  const L = useLayout();
  if (!L.wide) return <>{left}{right}{third}</>;
  const col = { gap: L.gap };
  if (L.xwide && third) {
    return (
      <View style={{ flexDirection: "row", gap: L.gap, alignItems: "flex-start" }}>
        <View style={[col, { flex: ratio }]}>{left}</View>
        <View style={[col, { flex: 1 }]}>{right}</View>
        <View style={[col, { flex: 1 }]}>{third}</View>
      </View>
    );
  }
  return (
    <View style={{ flexDirection: "row", gap: L.gap, alignItems: "flex-start" }}>
      <View style={[col, { flex: ratio }]}>{left}</View>
      <View style={[col, { flex: 1 }]}>{right}{third}</View>
    </View>
  );
}

/** Title block: small label, big title, optional action on the right. */
export function Header({ label, title, right, brand }: { label?: string; title: string; right?: React.ReactNode; brand?: boolean }) {
  const c = useTheme();
  const L = useLayout();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: L.fs(56), gap: 12 }}>
      <View style={{ flexShrink: 1 }}>
        {label ? <Label>{label}</Label> : null}
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.3} numberOfLines={1}
          style={[tight, { fontFamily: brand ? font.italic : font.display, fontSize: L.fs(L.wide ? 38 : 34), color: brand ? c.accent : c.ink, letterSpacing: -0.6 }]}>{title}</Text>
      </View>
      {right}
    </View>
  );
}
