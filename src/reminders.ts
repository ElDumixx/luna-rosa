// One gentle local reminder when the period usually arrives. No health alerts, no content pushes.
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { cycleInfo, periodAt, State } from "./cycle";
import { add, parse, today } from "./dates";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function askNotificationPermission() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("reminders", {
      name: "Recordatorios",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  const res = await Notifications.requestPermissionsAsync();
  return res.granted;
}

const at10 = (k: string) => { const d = parse(k); d.setHours(10, 0, 0, 0); return d; };

export async function scheduleReminder(S: State) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  const ci = cycleInfo(S);
  const T = today();
  if (!S.settings.remind || !ci.win || periodAt(S, T)) return;
  if (!(await Notifications.getPermissionsAsync()).granted) return;

  let when = at10(ci.win.start);
  if (when.getTime() <= Date.now()) {
    if (T > add(ci.win.end, 7)) return; // long cycle: the home screen offers to pause instead
    when = at10(add(T, 1));
  }
  await Notifications.scheduleNotificationAsync({
    content: { title: "Luna Rosa", body: "¿Te ha bajado la regla? Márcalo con un toque." },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: when,
      ...(Platform.OS === "android" ? { channelId: "reminders" } : {}),
    },
  });
}
