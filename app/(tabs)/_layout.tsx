// Tabs. iOS: native tab bar — Liquid Glass on iOS 26+, shrinking while you scroll down.
// Android: a floating bar whose highlight glides to the chosen tab.
import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import React, { ComponentProps, useState } from "react";
import { LayoutChangeEvent, Platform, Pressable, Text, View } from "react-native";
import Animated, { useAnimatedStyle, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { select } from "../../src/feedback";
import { alpha, bloom, font, petal, raised, useLayout, useTheme, webGlass } from "../../src/theme";

type Icon = keyof typeof Ionicons.glyphMap;
const TABS: { name: string; title: string; sf: [string, string]; icon: [Icon, Icon] }[] = [
  { name: "index", title: "Hoy", sf: ["drop", "drop.fill"], icon: ["water-outline", "water"] },
  { name: "calendar", title: "Calendario", sf: ["calendar", "calendar"], icon: ["calendar-outline", "calendar"] },
  { name: "guide", title: "Guía", sf: ["book", "book.fill"], icon: ["book-outline", "book"] },
  { name: "assistant", title: "Lu", sf: ["bubble.left.and.bubble.right", "bubble.left.and.bubble.right.fill"], icon: ["chatbubble-ellipses-outline", "chatbubble-ellipses"] },
];

type BarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

function FloatingBar({ state, navigateToTab }: BarProps) {
  const c = useTheme();
  const L = useLayout();
  const ins = useSafeAreaInsets();
  const [w, setW] = useState(0);
  const itemW = w / TABS.length;
  const barH = L.short ? 56 : L.compact ? 62 : L.tablet ? 74 : 68;
  const pill = useAnimatedStyle(() => ({ transform: [{ translateX: withSpring(state.index * itemW, { damping: 18, stiffness: 220, mass: 0.8 }) }] }));
  return (
    <>
    {/* content scrolling under the bar fades into the page instead of showing through behind it */}
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: barH + Math.max(ins.bottom, 10) + 36,
      backgroundImage: `linear-gradient(180deg, ${alpha(c.bg, 0)}, ${alpha(c.bg, webGlass ? 0.45 : 0.92)} 65%)` }} />
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: L.short ? 6 : Math.max(ins.bottom, 10) + 4, alignItems: "center" }}>
      <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width - 12)}
        style={[{ width: Math.min(L.width - (L.compact ? 20 : 28), L.tablet ? 560 : 460), height: barH, borderRadius: barH / 2, padding: 6, flexDirection: "row" },
          raised(c, 3, c.solid)]}>
        {w > 0 && (
          // the selected tab sits on a pastel pink petal that slides between tabs
          <Animated.View style={[{ position: "absolute", top: 6, left: 6, bottom: 6, width: itemW, backgroundColor: c.accentSoft }, petal(barH / 2 - 6, 0.45), pill]} />
        )}
        {state.routes.map((r, i) => {
          const t = TABS.find((x) => x.name === r.name);
          if (!t) return null;
          const on = state.index === i;
          return (
            <Pressable key={r.key} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={t.title}
              onPress={() => { select(); if (!on) navigateToTab(r.key); }}
              style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 2, flexDirection: L.short ? "row" : "column" }}>
              <Animated.View key={on ? "on" : "off"} entering={on ? bloom() : undefined}>
                <Ionicons name={t.icon[on ? 1 : 0]} size={L.fs(22)} color={on ? c.accent : c.muted} />
              </Animated.View>
              <Text numberOfLines={1} style={{ fontFamily: font.bold, fontSize: L.short || L.tablet ? 13 : L.compact ? 10 : 11, marginLeft: L.short ? 6 : 0, color: on ? c.accent : c.muted }}>{t.title}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
    </>
  );
}

export default function TabsLayout() {
  const c = useTheme();
  if (Platform.OS === "ios") {
    return (
      <NativeTabs minimizeBehavior="onScrollDown" tintColor={c.accent}
        labelStyle={{ default: { fontFamily: font.bold, fontSize: 10 }, selected: { fontFamily: font.bold, fontSize: 10, color: c.accent } }}>
        {TABS.map((t) => (
          <NativeTabs.Trigger key={t.name} name={t.name} contentStyle={{ backgroundColor: "transparent" }}>
            <NativeTabs.Trigger.Icon sf={{ default: t.sf[0] as any, selected: t.sf[1] as any }} />
            <NativeTabs.Trigger.Label>{t.title}</NativeTabs.Trigger.Label>
          </NativeTabs.Trigger>
        ))}
      </NativeTabs>
    );
  }
  return (
    <Tabs tabBar={(p) => <FloatingBar {...p} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: "transparent" }, animation: "fade", freezeOnBlur: true, tabBarHideOnKeyboard: true }}>
      {TABS.map((t) => <Tabs.Screen key={t.name} name={t.name} options={{ title: t.title }} />)}
    </Tabs>
  );
}
