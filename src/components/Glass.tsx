// Liquid Glass on iOS 26+ (GlassView) for the few floating controls; elsewhere the same shape as an opaque
// white surface with a hairline edge and one soft shadow (no translucency, which is costly to draw on Android).
import { GlassView } from "expo-glass-effect";
import React from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import { liquidGlass, raised, useTheme } from "../theme";

export function Glass({ style, children, interactive, tint, strong }: {
  style?: StyleProp<ViewStyle>; children?: React.ReactNode; interactive?: boolean; tint?: string; strong?: boolean;
}) {
  const c = useTheme();
  if (liquidGlass) {
    return (
      <GlassView glassEffectStyle="regular" isInteractive={interactive} tintColor={tint} colorScheme={c.scheme} style={style}>
        {children}
      </GlassView>
    );
  }
  const base = tint ? { backgroundColor: tint, ...raised(c, 1, tint), borderWidth: 0 } : raised(c, strong ? 2 : 1, strong ? c.solid : c.surface);
  return <View style={[base, style]}>{children}</View>;
}
