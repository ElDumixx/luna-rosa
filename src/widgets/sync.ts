import AsyncStorage from "@react-native-async-storage/async-storage";
import { isRunningInExpoGo } from "expo";
import Constants from "expo-constants";
import { Platform } from "react-native";
import type { State } from "../cycle";
import { makeSnapshot } from "./snapshot";

export const SNAPSHOT_KEY = "widget-snapshot";

export async function syncWidgets(S: State) {
  if (isRunningInExpoGo()) return; // widgets need the installed app
  const snap = makeSnapshot(S);
  const json = JSON.stringify(snap);

  if (Platform.OS === "ios") {
    // Shared with the WidgetKit extension through the App Group.
    const { ExtensionStorage } = require("@bacons/apple-targets");
    const group = (Constants.expoConfig?.extra as any)?.appGroup;
    const storage = new ExtensionStorage(group);
    storage.set("snapshot", json);
    ExtensionStorage.reloadWidget();
    return;
  }

  if (Platform.OS === "android") {
    await AsyncStorage.setItem(SNAPSHOT_KEY, json);
    const { requestWidgetUpdate } = require("react-native-android-widget");
    const { renderWidget, WIDGET_NAMES } = require("./AndroidWidgets") as typeof import("./AndroidWidgets");
    // Every kind of widget on the home screen, each drawn at its own size.
    for (const name of WIDGET_NAMES)
      await requestWidgetUpdate({ widgetName: name, renderWidget: (info: { width: number; height: number }) => renderWidget(name, snap, info), widgetNotFound: () => {} });
  }
}
