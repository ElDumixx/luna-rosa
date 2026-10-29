// Runs in the background when Android adds, resizes or refreshes a widget.
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { WidgetTaskHandlerProps } from "react-native-android-widget";
import { renderWidget } from "./AndroidWidgets";
import type { Snapshot } from "./snapshot";

export async function widgetTaskHandler({ widgetInfo, widgetAction, renderWidget: draw }: WidgetTaskHandlerProps) {
  if (widgetAction === "WIDGET_DELETED") return;
  let snap: Snapshot | null = null;
  try {
    const raw = await AsyncStorage.getItem("widget-snapshot");
    if (raw) snap = JSON.parse(raw);
  } catch {}
  draw(renderWidget(widgetInfo.widgetName, snap, widgetInfo));
}
