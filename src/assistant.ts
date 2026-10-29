// Lu, the assistant. With a server URL (server/, which holds the Claude API key) answers come from Claude
// with the user's cycle context; otherwise — or if the server fails — from the on-device brain (src/lu/brain.ts).
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { CycleInfo, State } from "./cycle";
import { contextText, LuAction, summarize, think } from "./lu/brain";

// `at`: when it was sent (ms). Older saved chats have none, and then no time is shown.
// `action`: a button under Lu's answer that does what was asked ("me ha bajado hoy" → mark the start).
export type Msg = { r: "u" | "a"; t: string; topic?: string; follow?: string[]; at?: number; action?: LuAction };
export type Answer = { text: string; topic: string; follow: string[]; action?: LuAction; source: "claude" | "local" };

const extra = (Constants.expoConfig?.extra ?? {}) as { assistantUrl?: string; assistantToken?: string };
const URL = extra.assistantUrl ?? "";
export const assistantOnline = !!URL;

/** Pulls the "Siguientes: a | b | c" line the server adds, so it becomes tappable suggestions. */
function splitFollow(text: string) {
  const lines = text.split("\n");
  const i = lines.findIndex((l) => /^siguientes:/i.test(l.trim()));
  if (i < 0) return { text, follow: [] as string[] };
  const follow = lines[i].replace(/^siguientes:/i, "").split("|").map((s) => s.trim()).filter(Boolean).slice(0, 3);
  lines.splice(i, 1);
  return { text: lines.join("\n").trim(), follow };
}

export async function ask(S: State, ci: CycleInfo, history: Msg[], question: string, wantSummary = false): Promise<Answer> {
  const local = think(S, ci, question, history);
  if (URL) {
    try {
      const res = await fetch(URL, {
        method: "POST",
        headers: { "content-type": "application/json", ...(extra.assistantToken ? { "x-app-token": extra.assistantToken } : {}) },
        body: JSON.stringify({
          mode: wantSummary ? "summary" : "answer",
          context: contextText(S, ci),
          messages: [...history.slice(-10), ...(wantSummary ? [] : [{ r: "u", t: question }])].map((m) => ({
            role: m.r === "u" ? "user" : "assistant",
            content: m.t,
          })),
        }),
      });
      if (res.status === 429) return { text: "Demasiadas preguntas seguidas. Espera un momento.", topic: "", follow: [], source: "claude" };
      if (res.ok) {
        const data = await res.json();
        if (data?.text) {
          const { text, follow } = splitFollow(String(data.text));
          if (wantSummary) return { text, topic: "", follow: [], source: "claude" };
          return { text, topic: local.topic, follow: follow.length ? follow : local.follow, action: local.action, source: "claude" };
        }
      }
    } catch {}
  }
  if (wantSummary) return { text: summarize(history), topic: "", follow: [], source: "local" };
  return { ...local, source: "local" };
}

// The conversation stays on the phone between visits.
const CHAT_KEY = "lu-chat-v1";
export const loadChat = async (): Promise<Msg[]> => {
  // An offer to mark the period ("Apuntar inicio hoy") was for that moment: it doesn't come back on another visit.
  try { const raw = await AsyncStorage.getItem(CHAT_KEY); return raw ? (JSON.parse(raw) as Msg[]).map(({ action, ...m }) => m) : []; } catch { return []; }
};
export const saveChat = (chat: Msg[]) => AsyncStorage.setItem(CHAT_KEY, JSON.stringify(chat.slice(-40))).catch(() => {});
