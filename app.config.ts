import type { ExpoConfig } from "expo/config";

// Fill these two in before building (see README):
//   APPLE_TEAM_ID  – your Apple developer Team ID (10 characters)
//   BUNDLE_ID      – a unique id, e.g. com.tunombre.lunarosa
const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID || undefined; // not needed for the Simulator
const BUNDLE_ID = process.env.BUNDLE_ID ?? "com.lunarosa.app";
export const APP_GROUP = `group.${BUNDLE_ID}`;
/** Android icon styles besides the default one; the names must match src/appIcon.ts. */
const ICON_STYLES = ["Cristal", "Noche", "Perla", "Atardecer", "Lavanda"];

/** One Android home-screen widget; `lock`: also offered on the lock screen (Android 16+). */
const widget = (name: string, label: string, description: string, w: number, h: number, lock = false) => ({
  name, label: `Luna Rosa · ${label}`, description,
  minWidth: `${w * 57 - 16}dp` as const, minHeight: `${h * 57 - 16}dp` as const, targetCellWidth: w, targetCellHeight: h,
  resizeMode: "horizontal|vertical" as const, updatePeriodMillis: 3600000,
  ...(lock ? { widgetCategory: "home_screen|keyguard" as const } : {}),
});

const config: ExpoConfig = {
  name: "Luna Rosa",
  slug: "luna-rosa",
  scheme: "lunarosa",
  version: "1.0.0",
  orientation: "default",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  ios: {
    bundleIdentifier: BUNDLE_ID,
    // iOS 26+: layered Liquid Glass icon from Icon Composer (light, dark, clear and tinted come from the same file).
    icon: "./assets/LunaRosa.icon",
    appleTeamId: APPLE_TEAM_ID,
    supportsTablet: true,
    entitlements: {
      "com.apple.security.application-groups": [APP_GROUP],
    },
    infoPlist: {
      NSHealthShareUsageDescription: "Luna Rosa lee tus reglas registradas en Salud para mostrarlas en tu calendario.",
      NSHealthUpdateUsageDescription: "Luna Rosa guarda en Salud los días de regla y el dolor que registras.",
    },
  },
  android: {
    package: BUNDLE_ID,
    adaptiveIcon: {
      // light "glass" moon over a pink-lilac gradient (scripts/make-icons.swift)
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundImage: "./assets/adaptive-icon-bg.png",
      monochromeImage: "./assets/adaptive-icon-mono.png", // Android 13+ themed icons
    },
    permissions: [
      "android.permission.health.READ_MENSTRUATION",
      "android.permission.health.WRITE_MENSTRUATION",
      "android.permission.POST_NOTIFICATIONS",
    ],
    // Added by default but not used: a health app should ask for as little as possible.
    // Deep links (lunarosa://…) declared here too, so they keep working with another icon style: those are
    // activity aliases, and Android only gives them the intent filters listed in the config.
    intentFilters: [{ action: "VIEW", category: ["BROWSABLE", "DEFAULT"], data: [{ scheme: "lunarosa" }] }],
    blockedPermissions: [
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.SYSTEM_ALERT_WINDOW",
    ],
  },
  plugins: [
    "expo-router",
    "expo-font",
    [
      "expo-splash-screen",
      // Same pearl and colors as the first frame of src/components/Splash.tsx, so the hand-off is seamless.
      { image: "./assets/splash-icon.png", imageWidth: 200, backgroundColor: "#FFF7F9", dark: { backgroundColor: "#150D12" } },
    ],
    ["expo-notifications", { color: "#D06E92" }],
    [
      "@kingstinct/react-native-healthkit",
      {
        NSHealthShareUsageDescription: "Luna Rosa lee tus reglas registradas en Salud para mostrarlas en tu calendario.",
        NSHealthUpdateUsageDescription: "Luna Rosa guarda en Salud los días de regla y el dolor que registras.",
        background: false,
      },
    ],
    "react-native-health-connect",
    [
      "expo-build-properties",
      {
        android: {
          minSdkVersion: 26,
          // Smaller, faster release APK/AAB: strip unused code and resources.
          enableMinifyInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
          // 64-bit ARM only: every phone sold since ~2017 (emulators on Apple Silicon too). Drops the 32-bit copies of every native library.
          buildArchs: ["arm64-v8a"],
          // Store native libraries compressed: a smaller APK to download and keep.
          useLegacyPackaging: true,
          // Health Connect and the widget library build their bridges by reflection: keep them whole.
          // WorkManager, which runs the widget updates, also creates its databases (Room *_Impl), input mergers and
          // workers by reflection: without these rules every widget update failed and the widgets stayed blank.
          extraProguardRules: "-keep class dev.matinzd.healthconnect.** { *; }\n-keep class com.reactnativeandroidwidget.** { *; }\n-keep class * extends androidx.room.RoomDatabase { *; }\n-keep class androidx.work.** { *; }\n-keep class * extends androidx.work.InputMerger { <init>(); }\n-keep class * extends androidx.work.ListenableWorker { <init>(android.content.Context, androidx.work.WorkerParameters); }",
        },
        ios: { deploymentTarget: "17.0" },
      },
    ],
    "@bacons/apple-targets",
    [
      "react-native-android-widget",
      {
        // The app's own fonts, so the widgets look like the app (fontFamily = file name).
        fonts: [
          "./node_modules/@expo-google-fonts/fraunces/600SemiBold/Fraunces_600SemiBold.ttf",
          "./node_modules/@expo-google-fonts/fraunces/600SemiBold_Italic/Fraunces_600SemiBold_Italic.ttf",
          "./node_modules/@expo-google-fonts/nunito/600SemiBold/Nunito_600SemiBold.ttf",
          "./node_modules/@expo-google-fonts/nunito/800ExtraBold/Nunito_800ExtraBold.ttf",
        ],
        // Drawn by src/widgets/AndroidWidgets.tsx. Refreshed when the app changes something and every hour,
        // so the day of the cycle is right soon after midnight without opening the app.
        widgets: [
          widget("LunaSmall", "Día", "Día del ciclo, fase, lo que falta y barra de fases", 2, 2, true),
          widget("LunaRing", "Anillo", "Tu ciclo en un anillo de fases", 2, 2, true),
          widget("LunaCountdown", "Cuenta atrás", "Días que faltan para tu regla y su fecha", 2, 2, true),
          widget("LunaMedium", "Próxima regla", "Ventana de la próxima regla, ovulación y ciclo", 4, 2),
          widget("LunaPhase", "Fase", "Tu fase, qué significa y cuál viene después", 4, 2),
          widget("LunaWeek", "Semana", "Esta semana: regla, prevista, ovulación y tu registro", 4, 2),
          widget("LunaQuick", "Registro rápido", "Tu día, lo que registraste y un botón para registrarlo", 4, 1),
          widget("LunaSummary", "Tus datos", "Ciclo típico, duración, dolor medio y última regla", 4, 2),
        ],
      },
    ],
    // Other app icon styles for Android (Ajustes → Icono de la app). Drawn by scripts/make-icons.swift.
    ["./plugins/withAndroidIconStyles", ICON_STYLES.map((n) => ({
      name: n,
      foregroundImage: `./assets/icons/${n.toLowerCase()}-fg.png`,
      backgroundImage: `./assets/icons/${n.toLowerCase()}-bg.png`,
      monochromeImage: "./assets/adaptive-icon-mono.png",
    }))],
  ],
  extra: {
    appGroup: APP_GROUP,
    // URL of your assistant server (server/README.md). Empty = offline answers only.
    assistantUrl: process.env.EXPO_PUBLIC_ASSISTANT_URL ?? "",
    assistantToken: process.env.EXPO_PUBLIC_ASSISTANT_TOKEN ?? "",
    // @paulbumb/luna-rosa on expo.dev (created with `eas init`)
    eas: { projectId: process.env.EAS_PROJECT_ID ?? "0b082b50-811a-43f7-b1cb-9625350c5039" },
  },
  // Web / PWA (scripts/build-pwa.js): one page app, so it can be hosted on GitHub Pages. EXPO_BASE_URL is the
  // folder it's served from there ("/<repository name>"); empty when served from the root of a domain.
  web: { output: "single", favicon: "./public/icon-192.png", name: "Luna Rosa", shortName: "Luna Rosa", lang: "es", themeColor: "#FFF7F9", backgroundColor: "#FFF7F9" },
  experiments: { typedRoutes: false, baseUrl: process.env.EXPO_BASE_URL || undefined },
};

export default config;
