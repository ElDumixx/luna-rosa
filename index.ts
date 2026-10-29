// Entry: Expo Router plus the Android widget task handler (runs headless when a widget updates).
import "expo-router/entry";
import { isRunningInExpoGo } from "expo";
import { Platform } from "react-native";

// Widgets need the installed app; Expo Go has no widget module.
if (Platform.OS === "android" && !isRunningInExpoGo()) {
  const { registerWidgetTaskHandler } = require("react-native-android-widget");
  registerWidgetTaskHandler(require("./src/widgets/androidTaskHandler").widgetTaskHandler);
}
