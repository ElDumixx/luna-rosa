import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CycleInfo, cycleInfo, EMPTY, mergePeriods, periodAt, predictedSet, State } from "./cycle";
import { today } from "./dates";
import { exportToHealth, importFromHealth } from "./health";
import { scheduleReminder } from "./reminders";
import { syncWidgets } from "./widgets/sync";

const KEY = "luna-rosa-v2";

type Store = {
  S: State;
  ready: boolean;
  update: (fn: (draft: State) => void) => void;
  reset: () => void;
  toast: (msg: string) => void;
  /** Cycle numbers and predicted days, computed once per change instead of on every render. */
  ci: CycleInfo;
  pred: Set<string>;
};
const Ctx = createContext<Store | null>(null);
// Toast text lives in its own context so showing one doesn't re-render every screen.
const ToastCtx = createContext<string | null>(null);

const clone = (s: State): State => JSON.parse(JSON.stringify(s));

// ---- one copy of the data for the whole app ----
// Android can start a second screen tree in the same app (a widget or a lunarosa:// link opening the app while an
// older tree is still alive). Each tree used to load and keep its own copy, and an older copy could be saved over
// newer changes, losing them. Now every tree reads and writes this single state, and a new tree opens instantly
// because the data is already loaded.
let shared: State | null = null;
let loading = false;
/** Changes asked for before the data finished loading: applied to it once loaded, never to an empty state. */
const pending: ((d: State) => void)[] = [];
const subs = new Set<(s: State) => void>();
const publish = (next: State) => { shared = next; subs.forEach((f) => f(next)); };

let saveT: ReturnType<typeof setTimeout> | undefined;
let lastReminder = "", lastWidget = "";
/** Save + keep widgets, reminder and health data in step with every change (debounced). */
function persist(next: State) {
  clearTimeout(saveT);
  saveT = setTimeout(async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
    // Only touch widgets and the scheduled reminder when what they show actually changed.
    const ci = cycleInfo(next);
    const widgetKey = JSON.stringify([ci.last, ci.typical, ci.lo, ci.hi, ci.dur, ci.pain, next.settings.paused, today(), next.days[today()] ?? null]);
    if (widgetKey !== lastWidget) { lastWidget = widgetKey; syncWidgets(next).catch(() => {}); }
    const reminderKey = JSON.stringify([next.settings.remind, ci.win, !!periodAt(next, today()), today()]);
    if (reminderKey !== lastReminder) { lastReminder = reminderKey; scheduleReminder(next).catch(() => {}); }
    if (next.settings.healthSync) {
      const written = await exportToHealth(next).catch(() => [] as string[]);
      // Added to whatever the state is by now (not to `next`, which may be older), then saved.
      if (written.length && shared) {
        const c = clone(shared);
        c.health.written = [...new Set([...c.health.written, ...written])];
        publish(c);
        AsyncStorage.setItem(KEY, JSON.stringify(c)).catch(() => {});
      }
    }
  }, 400);
}

function update(fn: (d: State) => void) {
  if (!shared) { pending.push(fn); return; }
  const d = clone(shared); fn(d); publish(d); persist(d);
}

async function load() {
  if (shared || loading) return;
  loading = true;
  let loaded: State = EMPTY();
  let readOk = true;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) loaded = { ...EMPTY(), ...JSON.parse(raw) };
  } catch { readOk = false; }
  // Pull new periods from Salud / Health Connect once a day when connected.
  if (loaded.settings.healthSync && loaded.health.lastImport !== today()) {
    try {
      const got = await importFromHealth();
      mergePeriods(loaded, got.periods);
      loaded.health.written = [...new Set([...loaded.health.written, ...got.markers])];
      loaded.health.lastImport = today();
    } catch {}
  }
  pending.splice(0).forEach((fn) => fn(loaded));
  loading = false;
  publish(loaded);
  // If reading failed, don't write the empty state over data that may still be on the phone.
  if (readOk) persist(loaded);
}

const reset = () => { const e = EMPTY(); publish(e); persist(e); };

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [S, setS] = useState<State>(() => shared ?? EMPTY());
  const [ready, setReady] = useState(shared != null);
  const [toastMsg, setToast] = useState<string | null>(null);
  const toastT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const toast = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(null), 1800);
  }, []);

  useEffect(() => {
    const on = (s: State) => { setS(s); setReady(true); };
    subs.add(on);
    if (shared) on(shared); else load();
    return () => { subs.delete(on); };
  }, []);

  const value = useMemo(() => {
    const ci = cycleInfo(S);
    return { S, ready, update, reset, toast, ci, pred: predictedSet(S, ci) };
  }, [S, ready, toast]);

  return (
    <Ctx.Provider value={value}>
      <ToastCtx.Provider value={toastMsg}>{children}</ToastCtx.Provider>
    </Ctx.Provider>
  );
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStore outside StoreProvider");
  return c;
}

export const useToastMsg = () => useContext(ToastCtx);
