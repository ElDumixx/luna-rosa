// One import per weight: the packages' index files would pull every weight (and its file) into the app.
import { Fraunces_600SemiBold } from "@expo-google-fonts/fraunces/600SemiBold";
import { Fraunces_600SemiBold_Italic } from "@expo-google-fonts/fraunces/600SemiBold_Italic";
import { Nunito_600SemiBold } from "@expo-google-fonts/nunito/600SemiBold";
import { Nunito_800ExtraBold } from "@expo-google-fonts/nunito/800ExtraBold";
import { useFonts } from "expo-font";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import { Platform, useColorScheme, View } from "react-native";
import { Backdrop } from "../src/components/Gradient";
import { NATIVE_FADE_MS, Splash, SPLASH_MIN_MS } from "../src/components/Splash";
import { Toast } from "../src/components/ui";
import { StoreProvider, useStore, useToastMsg } from "../src/store";
import { useTheme } from "../src/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});
// A short cross-fade to our own opening screen, which starts out identical to the system one.
SplashScreen.setOptions({ duration: NATIVE_FADE_MS, fade: true });

function Shell() {
  const c = useTheme();
  const dark = useColorScheme() === "dark";
  const { ready } = useStore();
  const toastMsg = useToastMsg();
  // Transparent navigation background so the shared backdrop shows behind every tab.
  const base = dark ? DarkTheme : DefaultTheme;
  const navTheme = { ...base, colors: { ...base.colors, background: "transparent", card: c.surface, text: c.ink, border: c.line, primary: c.accent } };
  const [minDone, setMinDone] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [drawn, setDrawn] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }} onLayout={() => setDrawn(true)}>
      <StatusBar style="auto" />
      <Backdrop />
      <ThemeProvider value={navTheme}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.bg } }}>
        <Stack.Screen name="(tabs)" options={{ contentStyle: { backgroundColor: "transparent" } }} />
        <Stack.Screen name="day/[date]" options={{ presentation: "modal" }} />
        <Stack.Screen name="settings" options={{ presentation: "modal" }} />
      </Stack>
      </ThemeProvider>
      {/* iOS: above the native Liquid Glass tab bar; Android: above the floating bar */}
      <Toast msg={toastMsg} bottom={Platform.OS === "ios" ? 104 : 108} />
      <Splash visible={!(ready && (minDone || skipped))} appDrawn={drawn && ready} onSkip={() => ready && setSkipped(true)}
        onShown={() => setTimeout(() => setMinDone(true), SPLASH_MIN_MS)} />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Fraunces_600SemiBold, Fraunces_600SemiBold_Italic, Nunito_600SemiBold, Nunito_800ExtraBold });
  if (!fontsLoaded) return null;
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
