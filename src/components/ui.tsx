// Shared building blocks of the "Pétalo" design: pressables, cards, petal badges, buttons, chips, pain picker, toast.
// Flat on purpose: plain fills and at most one shadow, and no animated colors, so long lists of chips stay light.
// Life comes from small springs that only run when something changes (a press, a chosen chip).
import Ionicons from "@expo/vector-icons/Ionicons";
import React, { memo, useState } from "react";
import { Platform, Pressable, StyleProp, Text, TextInput, View, ViewStyle } from "react-native";
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { PAIN } from "../content";
import { select, tap } from "../feedback";
import { alpha, bloom, disappear, enter, font, glossy, motion, painColor, Palette, pane, petal, raised, sunken, tight, Tone, useLayout, useTheme, webGlass } from "../theme";

type IconName = keyof typeof Ionicons.glyphMap;

/** Pressable that dips slightly while held and settles back, with a light tap of feedback. */
export function Press({ onPress, onLongPress, style, children, accessibilityLabel, accessibilityHint, accessibilityRole = "button", selected, disabled, feedback = "tap", scaleTo = 0.97 }: {
  onPress?: () => void; onLongPress?: () => void; style?: StyleProp<ViewStyle>; children: React.ReactNode; accessibilityLabel?: string; accessibilityHint?: string;
  accessibilityRole?: "button" | "link" | "tab" | "switch"; selected?: boolean; disabled?: boolean; feedback?: "tap" | "select" | "none"; scaleTo?: number;
}) {
  const s = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Pressable disabled={disabled} hitSlop={6} onLongPress={onLongPress}
      onPress={() => { if (feedback === "tap") tap(); else if (feedback === "select") select(); onPress?.(); }}
      onPressIn={() => { s.value = withSpring(scaleTo, motion.press); }}
      onPressOut={() => { s.value = withSpring(1, motion.press); }}
      accessibilityRole={accessibilityRole} accessibilityLabel={accessibilityLabel} accessibilityHint={accessibilityHint}
      accessibilityState={{ selected, disabled }}>
      <Animated.View style={[style, anim, disabled ? { opacity: 0.45 } : null]}>{children}</Animated.View>
    </Pressable>
  );
}
/** Kept for screens that still say Bouncy. */
export const Bouncy = Press;

/**
 * Content card: an opaque white sheet with a hairline edge and a soft shadow. `hero` is the pastel petal
 * at the top of a screen. Radius and padding follow the size class. `delay` fades it in when it first appears.
 */
export function Card({ children, style, delay, level = 1, tone = "default" }: {
  children: React.ReactNode; style?: StyleProp<ViewStyle>; delay?: number; level?: 1 | 2 | 3; tone?: "default" | "hero";
}) {
  const c = useTheme();
  const L = useLayout();
  const base: ViewStyle = { borderRadius: L.radius, padding: L.compact ? 15 : L.tablet ? 22 : 18, gap: L.compact ? 10 : 12, ...raised(c, level) };
  const hero: ViewStyle | null = tone === "hero" ? {
    ...petal(L.radius + 14), backgroundColor: c.soft, borderColor: c.scheme === "dark" ? c.edge : "#F9D5E1",
    backgroundImage: `linear-gradient(160deg, ${c.aurora[0]}, ${c.soft} 55%, ${c.aurora[2]})`,
    // on the web the pastel wash is see-through, so the hero is tinted glass like the rest
    ...(webGlass ? { backgroundColor: alpha(c.soft, 0.12), borderColor: c.scheme === "dark" ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.85)",
      backgroundImage: `linear-gradient(160deg, ${alpha(c.aurora[0], 0.45)}, ${alpha(c.soft, 0.08)} 55%, ${alpha(c.aurora[2], 0.38)})` } : null),
  } : null;
  return (
    <Animated.View entering={delay != null ? enter(delay) : undefined} style={[base, hero, style]}>
      {children}
    </Animated.View>
  );
}

export function Label({ children, color, fit }: { children: React.ReactNode; color?: string; fit?: boolean }) {
  const c = useTheme();
  const L = useLayout();
  return <Text numberOfLines={1} adjustsFontSizeToFit={fit} minimumFontScale={0.8} style={{ fontFamily: font.bold, fontSize: L.fs(11), letterSpacing: 1.2, textTransform: "uppercase", color: color ?? c.muted }}>{children}</Text>;
}

/** A petal-shaped tile in one of the pastel tints, with the icon in its deep shade. The mark at the start of each card. */
export function Badge({ icon, size = 30, tone = "pink" }: { icon: IconName; size?: number; tone?: Tone }) {
  const c = useTheme();
  return (
    <View style={{ width: size, height: size, ...petal(size * 0.5, 0.3), alignItems: "center", justifyContent: "center", backgroundColor: c.tint[tone] }}>
      <Ionicons name={icon} size={size * 0.5} color={c.tintDeep[tone]} />
    </View>
  );
}

/** Card title row: badge, label and an optional action on the right. */
export function CardHead({ icon, title, right, tone }: { icon: IconName; title: string; right?: React.ReactNode; tone?: Tone }) {
  const L = useLayout();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 32 }}>
      <Badge icon={icon} size={L.fs(30)} tone={tone} />
      <View style={{ flex: 1 }}><Label fit>{title}</Label></View>
      {right}
    </View>
  );
}

/**
 * Buttons, all pills. `primary` is solid raspberry, `soft` (or `ghost`) pastel pink with raspberry text,
 * `glass` a white pill with a hairline edge.
 */
export function Btn({ label, onPress, variant = "primary", small, icon, disabled, full, ghost }: {
  label: string; onPress: () => void; variant?: "primary" | "soft" | "glass"; small?: boolean; icon?: IconName; disabled?: boolean; full?: boolean; ghost?: boolean;
}) {
  const c = useTheme();
  const L = useLayout();
  const v = ghost ? "soft" : variant;
  const pad: ViewStyle = { paddingVertical: small ? 9 : L.tablet ? 16 : 14, paddingHorizontal: small ? (L.compact ? 12 : 15) : L.compact ? 14 : 22, minHeight: small ? 36 : 50, borderRadius: 999, alignItems: "center",
    justifyContent: "center", flexDirection: "row", gap: 7, alignSelf: full ? "stretch" : "auto" };
  const color = v === "primary" ? c.onAccent : v === "soft" ? c.accent : c.ink;
  const fill: ViewStyle = v === "primary" ? glossy(c, c.accent, small ? 1 : 2)
    : v === "soft" ? { backgroundColor: c.accentSoft }
    : { backgroundColor: pane(c), borderWidth: 1, borderColor: c.line };
  return (
    <Press onPress={onPress} disabled={disabled} style={[pad, fill]}>
      {icon && <Ionicons name={icon} size={small ? 15 : 18} color={color} />}
      {/* the web can't shrink text to fit, so there a long label wraps instead of being cut */}
      <Text numberOfLines={Platform.OS === "web" ? undefined : 1} adjustsFontSizeToFit minimumFontScale={0.85} style={[tight, { flexShrink: 1, textAlign: "center", fontFamily: font.bold, fontSize: L.fs(small ? 13 : 16), color }]}>{label}</Text>
    </Press>
  );
}

/** Round icon button (settings, close, arrows): a pastel pink disc. */
export function IconBtn({ icon, onPress, label, size = 44, color }: { icon: IconName; onPress: () => void; label: string; size?: number; color?: string }) {
  const c = useTheme();
  return (
    <Press onPress={onPress} accessibilityLabel={label}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center", backgroundColor: c.accentSoft }}>
      <Ionicons name={icon} size={size * 0.45} color={color ?? c.accent} />
    </Press>
  );
}

/**
 * Selectable chip: an outlined pill that fills with pastel pink and shows a check when chosen.
 * A plain Pressable (no spring): a day's log shows ~30 chips, and each spring would be one more animation to set up.
 */
export const Chip = memo(function Chip({ label, on, onPress, icon }: { label: string; on: boolean; onPress: () => void; icon?: IconName }) {
  const c = useTheme();
  return (
    <Pressable onPress={() => { select(); onPress(); }} hitSlop={4} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: on }}
      style={({ pressed }) => ({ borderRadius: 999, paddingVertical: 9, paddingHorizontal: 14, borderWidth: 1.5, flexDirection: "row", gap: 6, alignItems: "center",
        backgroundColor: on ? c.accentSoft : pane(c), borderColor: on ? c.pink : c.line, opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] })}>
      {on ? <Animated.View key="on" entering={bloom()}><Ionicons name="checkmark" size={15} color={c.accent} /></Animated.View>
        : icon ? <Ionicons name={icon} size={15} color={c.accent} /> : null}
      <Text style={{ fontFamily: font.bold, fontSize: 14, color: on ? c.accent : c.ink }}>{label}</Text>
    </Pressable>
  );
});

export function Chips({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((o) => <Chip key={o} label={o} on={selected.includes(o)} onPress={() => onToggle(o)} />)}
    </View>
  );
}

export function AddOther({ placeholder, onAdd }: { placeholder: string; onAdd: (v: string) => void }) {
  const c = useTheme();
  const [v, setV] = useState("");
  const submit = () => { const t = v.trim(); if (t) { onAdd(t); setV(""); } };
  return (
    <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
      <TextInput value={v} onChangeText={setV} onSubmitEditing={submit} placeholder={placeholder} placeholderTextColor={c.faint}
        returnKeyType="done" maxLength={40}
        style={{ flex: 1, ...sunken(c), borderRadius: 999,
          paddingHorizontal: 16, paddingVertical: 10, fontFamily: font.body, fontSize: 15, color: c.ink }} />
      <Btn label="Añadir" variant="soft" small disabled={!v.trim()} onPress={submit} />
    </View>
  );
}

function Meter({ p, c }: { p: number; c: Palette }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 3, height: 22 }}>
      {[0, 1, 2].map((i) => <View key={i} style={{ width: 6, height: 8 + i * 7, borderRadius: 3, backgroundColor: i < p ? painColor(c, p) : c.p0 }} />)}
    </View>
  );
}

/** Four pain levels as petal tiles; the chosen one fills with pastel pink. */
export function PainPicker({ value, onPick }: { value: number | null; onPick: (v: number) => void }) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {[3, 2, 1, 0].map((v) => {
        const on = value === v;
        return (
          <View key={v} style={{ flex: 1 }}>
            <Press onPress={() => onPick(v)} selected={on} feedback="select" accessibilityLabel={`Dolor ${PAIN[v]}`}
              style={{ ...petal(22, 0.4), paddingVertical: 13, alignItems: "center", gap: 7, borderWidth: 1.5,
                backgroundColor: on ? c.accentSoft : pane(c), borderColor: on ? c.pink : c.line }}>
              <Meter p={v} c={c} />
              <Text style={{ fontFamily: font.bold, fontSize: 13, color: on ? c.accent : c.ink }} numberOfLines={1} adjustsFontSizeToFit>{PAIN[v]}</Text>
            </Press>
          </View>
        );
      })}
    </View>
  );
}

/** Short confirmation: a plum pill that fades in and away. */
export function Toast({ msg, bottom = 116 }: { msg: string | null; bottom?: number }) {
  const c = useTheme();
  if (!msg) return null;
  const fill = c.scheme === "dark" ? c.ink : "#3A1F2D";
  return (
    <Animated.View key={msg} entering={FadeInDown.duration(motion.base).easing(motion.ease).withInitialValues({ opacity: 0, transform: [{ translateY: 6 }] })} exiting={disappear} pointerEvents="none"
      accessibilityLiveRegion="polite" style={{ position: "absolute", alignSelf: "center", bottom, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 11,
        flexDirection: "row", gap: 8, alignItems: "center", backgroundColor: fill, boxShadow: "0px 10px 24px -12px rgba(0,0,0,0.45)" }}>
      <Ionicons name="checkmark-circle" size={18} color={c.pink} />
      <Text style={{ fontFamily: font.bold, color: c.scheme === "dark" ? c.bg : "#FFFFFF", fontSize: 14 }}>{msg}</Text>
    </Animated.View>
  );
}
