import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Keyboard, KeyboardAvoidingView, NativeScrollEvent, NativeSyntheticEvent, Platform, ScrollView, Text, TextInput, TextInputInstance, View } from "react-native";
import Animated, { cancelAnimation, Easing, FadeIn, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Glass } from "../../src/components/Glass";
import { Lu } from "../../src/components/Lu";
import { Badge, IconBtn, Press } from "../../src/components/ui";
import { ask, assistantOnline, loadChat, Msg, saveChat } from "../../src/assistant";
import { setEnd, setStart } from "../../src/cycle";
import { add, fmt, MESL, today } from "../../src/dates";
import { select, success } from "../../src/feedback";
import { LuAction, suggestions, think } from "../../src/lu/brain";
import { useStore } from "../../src/store";
import { webGlass, alpha, appear, bloom, depth, disappear, font, glossy, motion, Palette, petal, pop, raised, Tone, useLayout, useTheme } from "../../src/theme";

type IconName = keyof typeof Ionicons.glyphMap;
const ios = Platform.OS === "ios";

const iconFor = (q: string): IconName => {
  const s = q.toLowerCase();
  if (/baja|próxima|retras/.test(s)) return "calendar";
  if (/fase|ovul/.test(s)) return "moon";
  if (/dolor|analg/.test(s)) return "medkit";
  if (/resumen|datos/.test(s)) return "stats-chart";
  if (/normal|ciclo/.test(s)) return "analytics";
  if (/antojo|como/.test(s)) return "ice-cream";
  if (/cansad|sensible|ánimo/.test(s)) return "happy";
  if (/coágul|sangr|dura/.test(s)) return "water";
  return "sparkles";
};

/** "Buenos días" / "Buenas tardes" / "Buenas noches" for the welcome. */
const hello = () => { const h = new Date().getHours(); return h < 6 ? "Hola" : h < 13 ? "Buenos días" : h < 21 ? "Buenas tardes" : "Buenas noches"; };

const pad2 = (n: number) => String(n).padStart(2, "0");
const clock = (t: number) => { const d = new Date(t); return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
const dayKey = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`; };
/** "Hoy", "Ayer" or "12 de octubre" for the separators between days. */
const dayLabel = (t: number) => {
  const d = new Date(t), now = new Date();
  const days = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 864e5);
  return days === 0 ? "Hoy" : days === 1 ? "Ayer" : `${d.getDate()} de ${MESL[d.getMonth()]}`;
};

/** Inline **bold** inside a line. `selectable`: long-press to copy. */
function Inline({ text, style, bold }: { text: string; style: object; bold: object }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return <Text selectable style={style}>{parts.map((p, i) => p.startsWith("**") ? <Text key={i} style={bold}>{p.slice(2, -2)}</Text> : p)}</Text>;
}

/** Lu's answers: a lead sentence, bullet or numbered points, and "Consulta si" / "Urgente" callouts. */
function Rich({ text, c, fs, animate }: { text: string; c: Palette; fs: (n: number) => number; animate?: boolean }) {
  const body = { fontFamily: font.body, fontSize: fs(15.5), lineHeight: fs(23), color: c.ink };
  const bold = { fontFamily: font.bold };
  // A new answer appears line by line, like Lu saying it; restored ones show at once.
  const line = (i: number, node: React.ReactNode) => <Animated.View key={i} entering={animate ? pop(140 + i * 110) : undefined}>{node}</Animated.View>;
  return (
    <View style={{ gap: 8 }}>
      {text.split(/\n+/).filter((l) => l.trim()).map((raw, i) => line(i, (() => {
        const l = raw.trim();
        const callout = l.match(/^(consulta si|urgente):\s*(.*)$/i);
        if (callout) {
          const urgent = callout[1].toLowerCase() === "urgente";
          const tone = urgent ? c.period : c.accent2;
          return (
            <View style={{ flexDirection: "row", gap: 10, padding: 12, borderRadius: 16, marginTop: 4, overflow: "hidden",
              backgroundColor: alpha(tone, urgent ? 0.12 : 0.08), borderWidth: 1, borderColor: alpha(tone, 0.25) }}>
              {/* a colored edge marks it as a note, not part of the answer */}
              <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, backgroundColor: tone }} />
              <Ionicons name={urgent ? "alert-circle" : "medical"} size={18} color={tone} style={{ marginTop: 2, marginLeft: 2 }} />
              <Text selectable style={{ flexShrink: 1, ...body, fontSize: fs(14.5), lineHeight: fs(21) }}>
                <Text style={{ fontFamily: font.bold, color: tone }}>{urgent ? "Urgente: " : "Consulta si: "}</Text>{callout[2]}
              </Text>
            </View>
          );
        }
        const num = l.match(/^(\d+)[.)]\s+(.*)$/);
        if (num || /^[-•*]\s+/.test(l)) {
          return (
            <View style={{ flexDirection: "row", gap: 10, paddingLeft: 2 }}>
              {num
                ? <View style={{ width: 22, height: 22, borderRadius: 11, marginTop: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.accentSoft }}>
                    <Text style={{ fontFamily: font.bold, fontSize: 12, color: c.accent }}>{num[1]}</Text>
                  </View>
                : <View style={{ width: 7, height: 7, borderRadius: 4, marginTop: fs(8), backgroundColor: c.pink }} />}
              {/* flexShrink, not flex: inside an auto-width bubble flex:1 collapses the text on Android */}
              <Inline text={num ? num[2] : l.replace(/^[-•*]\s+/, "")} style={{ flexShrink: 1, ...body }} bold={bold} />
            </View>
          );
        }
        return <Inline text={l} style={{ flexShrink: 1, ...body, ...(i === 0 ? { fontFamily: font.bold, fontSize: fs(16.5) } : null) }} bold={bold} />;
      })()))}
    </View>
  );
}

function Dot({ i, c }: { i: number; c: Palette }) {
  const still = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (!still) y.value = withDelay(i * 140, withRepeat(withSequence(
      withTiming(1, { duration: 300, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 300, easing: Easing.in(Easing.quad) }), withTiming(0, { duration: 260 })), -1));
    return () => cancelAnimation(y);
  }, [still]);
  // "typing": the dots hop in a wave and light up as they rise
  const st = useAnimatedStyle(() => ({ opacity: 0.35 + y.value * 0.65, transform: [{ translateY: -y.value * 6 }, { scale: 0.9 + y.value * 0.2 }] }));
  return <Animated.View style={[{ width: 9, height: 9, borderRadius: 5, backgroundColor: [c.accent, c.pink, c.accent2][i] }, st]} />;
}

/** A soft ring that keeps spreading out from behind Lu's face while she's busy. */
function Halo({ on, size, color }: { on: boolean; size: number; color: string }) {
  const still = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (!on || still) { cancelAnimation(t); t.value = withTiming(0, { duration: 200 }); return; }
    t.value = 0;
    t.value = withRepeat(withTiming(1, { duration: 1300, easing: Easing.out(Easing.quad) }), -1);
    return () => cancelAnimation(t);
  }, [on, still]);
  const st = useAnimatedStyle(() => ({ opacity: on ? 0.55 * (1 - t.value) : 0, transform: [{ scale: 1 + t.value * 0.45 }] }));
  return <Animated.View pointerEvents="none" style={[{ position: "absolute", width: size, height: size, borderRadius: size / 2, borderWidth: 3, borderColor: color }, st]} />;
}

/** A twinkling sparkle around Lu on the welcome screen. */
function Sparkle({ x, y, size, delay, color }: { x: `${number}%`; y: `${number}%`; size: number; delay: number; color: string }) {
  const still = useReducedMotion();
  const o = useSharedValue(still ? 1 : 0);
  useEffect(() => {
    if (still) return;
    o.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }), withTiming(0.15, { duration: 1100, easing: Easing.inOut(Easing.sin) })), -1));
    return () => cancelAnimation(o);
  }, [still]);
  const st = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ scale: 0.6 + o.value * 0.4 }, { rotate: `${o.value * 25}deg` }] }));
  return <Animated.View pointerEvents="none" style={[{ position: "absolute", left: x, top: y }, st]}><Ionicons name="sparkles" size={size} color={color} /></Animated.View>;
}

/** The pastel disc behind the big Lu: it breathes slowly with her. */
function Glow({ size, color }: { size: number; color: string }) {
  const still = useReducedMotion();
  const b = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    b.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(b);
  }, [still]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: 0.96 + b.value * 0.08 }, { rotate: `${b.value * 8 - 4}deg` }] }));
  return <Animated.View style={[{ position: "absolute", width: size, height: size, ...petal(size / 2, 0.45), backgroundColor: color }, st]} />;
}

/** Lu's answer: a full-width card (more room to read than a side bubble) signed with her face, name and time. */
function LuCard({ c, children, at, thinking, animate = true }: { c: Palette; children: React.ReactNode; at?: number; thinking?: boolean; animate?: boolean }) {
  const L = useLayout();
  return (
    <Animated.View entering={animate ? pop(0, "left") : undefined} style={[{ alignSelf: "stretch", padding: L.compact ? 14 : 16, gap: 10 },
      raised(c, 1, c.solid), petal(L.radius - 4, 0.3)]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: c.tint.pink }}>
          <Lu size={22} still={!thinking} thinking={thinking} />
        </View>
        <Text style={{ fontFamily: font.bold, fontSize: 13, color: c.ink }}>Lu</Text>
        {thinking
          ? <Text style={{ fontFamily: font.bold, fontSize: 12, color: c.accent }}>está pensando…</Text>
          : !!at && <Text style={{ fontFamily: font.bold, fontSize: 12, color: c.faint }}>{clock(at)}</Text>}
      </View>
      {children}
    </Animated.View>
  );
}

/** Your message: a pastel pink bubble on the right, with its time underneath. */
function UserBubble({ c, text, at, animate }: { c: Palette; text: string; at?: number; animate: boolean }) {
  const L = useLayout();
  return (
    <Animated.View entering={animate ? pop(0, "right") : undefined} style={{ alignSelf: "flex-end", maxWidth: L.wide ? "70%" : "84%", alignItems: "flex-end", gap: 4 }}>
      <View style={{ borderRadius: 22, borderBottomRightRadius: 6, paddingHorizontal: 16, paddingVertical: 11, backgroundColor: c.pink }}>
        <Text selectable style={{ fontFamily: font.body, color: c.onPeriod, fontSize: L.fs(15.5), lineHeight: L.fs(21) }}>{text}</Text>
      </View>
      {!!at && <Text style={{ fontFamily: font.bold, fontSize: 11, color: c.faint, marginRight: 6 }}>{clock(at)}</Text>}
    </Animated.View>
  );
}

function DaySep({ c, at }: { c: Palette; at: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 2 }} accessibilityRole="header">
      <View style={{ flex: 1, height: 1, backgroundColor: c.line }} />
      <Text style={{ fontFamily: font.bold, fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: c.muted }}>{dayLabel(at)}</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: c.line }} />
    </View>
  );
}

/**
 * One message. Memoized: a message never changes once sent, so typing or a new answer doesn't redraw (and re-parse) the
 * whole conversation. `animate`: only messages sent now slide in, not the ones restored when the tab opens.
 */
const Row = memo(function Row({ m, c, animate }: { m: Msg; c: Palette; animate: boolean }) {
  const L = useLayout();
  return m.r === "u"
    ? <UserBubble c={c} text={m.t} at={m.at} animate={animate} />
    : <LuCard c={c} at={m.at} animate={animate}><Rich text={m.t} c={c} fs={L.fs} animate={animate} /></LuCard>;
});

const dayName = (k: string) => (k === today() ? "hoy" : k === add(today(), -1) ? "ayer" : `el ${fmt(k)}`);
const actionLabel = (a: LuAction) => `${a.kind === "start" ? "Apuntar inicio" : "Marcar fin"} ${dayName(a.day)}`;

/**
 * The text box keeps its own state, so typing doesn't redraw the conversation above it. It's uncontrolled (no `value`):
 * the app never writes the text back while you type, so a busy moment can't drop letters you just typed.
 */
const Composer = memo(function Composer({ c, busy, onSend, bottom, maxWidth }: { c: Palette; busy: boolean; onSend: (q: string) => void; bottom: number; maxWidth: number }) {
  const L = useLayout();
  const box = useRef<TextInputInstance>(null);
  const [q, setQ] = useState("");
  const canSend = !busy && !!q.trim();
  const submit = () => { if (!canSend) return; onSend(q); box.current?.clear(); setQ(""); };
  // the send button wakes up when there's something to send: it grows with a little bounce and its arrow lifts
  const ready = useSharedValue(0);
  const [focus, setFocus] = useState(false);
  useEffect(() => { ready.value = withSpring(canSend ? 1 : 0, { damping: 12, stiffness: 260 }); }, [canSend]);
  const sendSt = useAnimatedStyle(() => ({ transform: [{ scale: 0.86 + ready.value * 0.14 }, { translateY: (1 - ready.value) * 3 }] }));
  return (
    <View style={{ paddingHorizontal: L.pad, paddingTop: 8, paddingBottom: bottom, alignItems: "center" }}>
      <Glass strong interactive style={[{ width: "100%", maxWidth, flexDirection: "row", gap: 8, alignItems: "flex-end", borderRadius: 28, padding: 6 },
        focus ? { borderColor: alpha(c.accent, 0.45), borderWidth: 1.5 } : null]}>
        <TextInput ref={box} onChangeText={setQ} placeholder="Pregúntale a Lu…" placeholderTextColor={c.faint} multiline
          onSubmitEditing={submit} submitBehavior="submit" onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} returnKeyType="send" maxLength={500} accessibilityLabel="Tu pregunta"
          style={{ flex: 1, maxHeight: 120, paddingHorizontal: 14, paddingTop: 11, paddingBottom: 11, fontFamily: font.body, fontSize: L.fs(16), color: c.ink }} />
        <Press onPress={submit} disabled={!canSend} accessibilityLabel="Enviar" feedback="none"
          style={[{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
            canSend ? glossy(c, c.accent, 1) : { backgroundColor: c.well }]}>
          <Animated.View style={sendSt}><Ionicons name="arrow-up" size={22} color={canSend ? c.onAccent : c.faint} /></Animated.View>
        </Press>
      </Glass>
      {q.length > 400 && <Text style={{ fontFamily: font.bold, fontSize: 11, color: c.muted, marginTop: 4 }}>{500 - q.length} caracteres</Text>}
    </View>
  );
});

export default function Assistant() {
  const c = useTheme();
  const L = useLayout();
  const ins = useSafeAreaInsets();
  const { S, ci, update } = useStore();
  const [chat, setChat] = useState<Msg[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [kb, setKb] = useState(false);
  const [headH, setHeadH] = useState(ins.top + 80);
  const [farUp, setFarUp] = useState(false);
  const [cheer, setCheer] = useState(0); // goes up with every answer: Lu hops and smiles // shows the "back to the latest message" button
  const scroll = useRef<{ scrollToEnd: (o?: { animated?: boolean }) => void } | null>(null);
  const stick = useRef(true); // follow new messages while the reader is at the bottom
  const sending = useRef(false); // a second tap on send (or Enter) before the first is handled is ignored
  const restored = useRef(0); // messages loaded from the phone: shown at once, without the slide-in
  const { q: incoming } = useLocalSearchParams<{ q?: string }>(); // a question sent from another screen

  useEffect(() => { loadChat().then((m) => { restored.current = m.length; setChat(m); setLoaded(true); }); }, []);
  useEffect(() => { if (loaded) saveChat(chat); }, [chat, loaded]);
  // While the keyboard is open the tab bar is hidden behind it, so drop the space reserved for it.
  useEffect(() => {
    const show = Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", () => setKb(true));
    const hide = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", () => setKb(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  // Opening the tab shows the latest message; leaving it closes the keyboard so it doesn't stay open over another screen.
  useFocusEffect(useCallback(() => {
    const t = setTimeout(() => scroll.current?.scrollToEnd({ animated: false }), 60);
    return () => { clearTimeout(t); Keyboard.dismiss(); };
  }, []));
  useEffect(() => { if (loaded) setTimeout(() => scroll.current?.scrollToEnd({ animated: false }), 60); }, [loaded]);
  // On the welcome screen Lu waves hello shortly after it opens.
  useEffect(() => {
    if (!loaded || chat.length) return;
    const t = setTimeout(() => setCheer((n) => n + 1), 650);
    return () => clearTimeout(t);
  }, [loaded, chat.length === 0]);

  const send = async (question: string, wantSummary = false) => {
    const text = question.trim();
    if (sending.current || (!wantSummary && !text)) return;
    sending.current = true;
    select();
    const history = chat;
    if (!wantSummary) setChat((h) => [...h, { r: "u", t: text, at: Date.now() }]);
    setBusy(true);
    stick.current = true;
    try {
      const a = await ask(S, ci, history, text, wantSummary);
      // A brief pause so the answer doesn't land in the same frame as the question; the local brain takes ~1 ms.
      if (a.source === "local") await new Promise((r) => setTimeout(r, 300));
      setChat((h) => [...h, { r: "a", t: a.text, topic: a.topic, follow: a.follow, action: a.action, at: Date.now() }]);
      setCheer((n) => n + 1);
    } finally {
      setBusy(false);
      sending.current = false;
    }
  };

  // A question sent from another screen (Lu's tip on Today) is asked as soon as the chat is loaded.
  useEffect(() => {
    if (!loaded || !incoming || busy) return;
    router.setParams({ q: undefined });
    send(String(incoming));
  }, [loaded, incoming]);

  // The memoized composer gets one stable callback that always runs the latest `send`.
  const sendRef = useRef(send);
  sendRef.current = send;
  const onSend = useCallback((t: string) => { sendRef.current(t); }, []);

  /** Does what Lu offered (mark the start or end of the period) and confirms it in the chat. */
  const act = (a: LuAction) => {
    update((s) => { if (a.kind === "start") setStart(s, a.day); else setEnd(s, a.day); });
    success();
    stick.current = true;
    setCheer((n) => n + 1);
    const when = dayName(a.day);
    const t = a.kind === "start"
      ? `Hecho: he apuntado ${when} como el primer día de tu regla.\n- Cuando termine, dime «se me ha ido» o márcalo en Hoy.\n- Con cada regla que marcas, mis previsiones se ajustan a ti.`
      : `Hecho: he marcado ${when} como el último día de tu regla.\n- Ya cuento su duración para tus próximas previsiones.`;
    setChat((h) => [...h.map((m) => (m.action ? { ...m, action: undefined } : m)),
      { r: "a", t, topic: "registrar", follow: a.kind === "start" ? ["¿Cómo alivio el dolor?", "¿Cuánto me suele durar?"] : ["¿Cuándo me baja?", "Resumen de mis datos"], at: Date.now() }]);
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const below = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    stick.current = below < 120;
    setFarUp(below > 400);
  };

  const greeting = useMemo(() => think(S, ci, "hola").text.replace(/^¡Hola! /, "").replace(/ ¿En qué te ayudo\?$/, ""), [S, ci]);
  const sugg = useMemo(() => suggestions(S, ci), [S, ci]);
  const last = chat[chat.length - 1];
  const chatMax = L.tablet ? 860 : 720;
  const barSpace = ios ? 8 : kb ? 8 : (L.short ? 6 : Math.max(ins.bottom, 10) + 4) + (L.short ? 56 : 68) + 10;
  const input = <Composer c={c} busy={busy} onSend={onSend} bottom={barSpace} maxWidth={chatMax} />;

  // messages, with a separator whenever the day changes
  const rows = useMemo(() => {
    const out: React.ReactNode[] = [];
    let prevDay = "";
    chat.forEach((m, i) => {
      if (m.at && dayKey(m.at) !== prevDay) { prevDay = dayKey(m.at); out.push(<DaySep key={`d${i}`} c={c} at={m.at} />); }
      out.push(<Row key={i} m={m} c={c} animate={i >= restored.current} />);
    });
    return out;
  }, [chat, c]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <View style={{ flex: 1 }}>
        <ScrollView ref={scroll as any} style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled"
          onScroll={onScroll} scrollEventThrottle={64}
          onContentSizeChange={() => { if (chat.length && stick.current) scroll.current?.scrollToEnd({ animated: true }); }}
          contentContainerStyle={{ paddingHorizontal: L.pad, paddingTop: headH + 12, paddingBottom: 16, alignItems: "center", flexGrow: 1 }}>
          <View style={{ width: "100%", maxWidth: chatMax, gap: 14, flexGrow: 1 }}>
            <Press onPress={() => update((s) => { s.settings.useData = !s.settings.useData; })} feedback="select" accessibilityRole="switch" selected={S.settings.useData}
              accessibilityLabel="Usar mis datos de ciclo en las respuestas" style={{ alignSelf: "center" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
                backgroundColor: S.settings.useData ? c.accentSoft : c.surface, borderWidth: 1, borderColor: S.settings.useData ? alpha(c.accent, 0.3) : c.line }}>
                <Ionicons name={S.settings.useData ? "shield-checkmark" : "shield-outline"} size={14} color={S.settings.useData ? c.accent : c.muted} />
                <Text style={{ fontFamily: font.bold, fontSize: 12, color: S.settings.useData ? c.accent : c.muted }}>
                  {S.settings.useData ? "Usando tus datos · solo en tu móvil" : "Sin usar tus datos"}
                </Text>
              </View>
            </Press>

            {chat.length === 0 && loaded && (
              <View style={{ alignItems: "center", gap: 10, paddingTop: 6 }}>
                <Animated.View entering={bloom()} style={{ width: L.fs(180), height: L.fs(170), alignItems: "center", justifyContent: "center" }}>
                  <Glow size={L.fs(150)} color={alpha(c.pink, c.scheme === "dark" ? 0.18 : 0.4)} />
                  <Sparkle x="6%" y="14%" size={L.fs(18)} delay={0} color={c.accent} />
                  <Sparkle x="82%" y="6%" size={L.fs(14)} delay={700} color={c.accent2} />
                  <Sparkle x="86%" y="70%" size={L.fs(16)} delay={1300} color={c.accent} />
                  <Sparkle x="2%" y="74%" size={L.fs(12)} delay={1900} color={c.accent2} />
                  <Lu size={L.fs(112)} arms cheer={cheer} />
                </Animated.View>
                <Animated.Text entering={pop(80)} style={{ fontFamily: font.display, fontSize: L.fs(28), color: c.ink, textAlign: "center" }}>{hello()}, soy Lu</Animated.Text>
                <Animated.Text entering={pop(160)} style={{ fontFamily: font.body, fontSize: L.fs(15), lineHeight: L.fs(22), color: c.muted, textAlign: "center", maxWidth: 360 }}>
                  {greeting} Pregúntame lo que quieras sobre tu ciclo.
                </Animated.Text>
                <Text style={{ alignSelf: "flex-start", marginTop: 10, marginLeft: 4, fontFamily: font.bold, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: c.muted }}>
                  Para empezar
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
                  {sugg.map((s, i) => (
                    <Animated.View key={s} entering={pop(240 + i * 80)} style={{ width: L.wide ? "23%" : "47%", flexGrow: L.wide ? 0 : 1 }}>
                      <Press onPress={() => send(s)} accessibilityLabel={s}
                        style={[{ padding: 14, gap: 10, minHeight: L.fs(108), justifyContent: "space-between" }, raised(c, 1), petal(24, 0.4)]}>
                        <Badge icon={iconFor(s)} size={L.fs(34)} tone={(["pink", "lilac", "peach", "mint"] as Tone[])[i % 4]} />
                        <Text style={{ fontFamily: font.bold, fontSize: L.fs(14), lineHeight: L.fs(19), color: c.ink }}>{s}</Text>
                      </Press>
                    </Animated.View>
                  ))}
                </View>
              </View>
            )}

            {rows}

            {busy && (
              <LuCard c={c} thinking>
                <View style={{ flexDirection: "row", gap: 6, paddingVertical: 4, paddingHorizontal: 2 }} accessibilityLabel="Lu está escribiendo">
                  {[0, 1, 2].map((i) => <Dot key={i} i={i} c={c} />)}
                </View>
              </LuCard>
            )}

            {!busy && last?.r === "a" && last.action && (
              <Animated.View entering={bloom(450)} style={{ alignSelf: "flex-start" }}>
                <Press onPress={() => act(last.action!)} feedback="none" accessibilityLabel={actionLabel(last.action)}
                  style={[{ flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 18 }, glossy(c, c.accent, 1)]}>
                  <Ionicons name={last.action.kind === "start" ? "water" : "checkmark-circle"} size={18} color={c.onAccent} />
                  <Text style={{ fontFamily: font.bold, fontSize: L.fs(15), color: c.onAccent }}>{actionLabel(last.action)}</Text>
                </Press>
              </Animated.View>
            )}

            {!busy && last?.r === "a" && !!last.follow?.length && (
              <Animated.View entering={FadeIn.duration(motion.base).delay(350)} style={{ gap: 8 }}>
                <Text style={{ marginLeft: 4, fontFamily: font.bold, fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: c.muted }}>También puedes preguntar</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -L.pad }}
                  contentContainerStyle={{ gap: 8, paddingHorizontal: L.pad, paddingVertical: 4 }}>
                  {last.follow.map((f, i) => (
                    <Animated.View key={f} entering={pop(420 + i * 90, "left")}>
                      <Press onPress={() => send(f)} accessibilityLabel={f}
                        style={[{ flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 14 }, raised(c, 1, c.solid)]}>
                        <Ionicons name={iconFor(f)} size={15} color={c.accent} />
                        <Text style={{ fontFamily: font.bold, fontSize: L.fs(13.5), color: c.ink }}>{f}</Text>
                      </Press>
                    </Animated.View>
                  ))}
                </ScrollView>
              </Animated.View>
            )}
          </View>
        </ScrollView>

        {/* header floats over the conversation; what scrolls under it fades out instead of being cut */}
        <View pointerEvents="box-none" onLayout={(e) => setHeadH(e.nativeEvent.layout.height)}
          style={{ position: "absolute", top: 0, left: 0, right: 0, paddingTop: ins.top + 6, paddingBottom: 16, paddingHorizontal: L.pad, alignItems: "center",
            backgroundImage: `linear-gradient(180deg, ${alpha(c.bg, webGlass ? 0.55 : 0.96)} 40%, ${alpha(c.bg, 0)})` }}>
          <Glass strong style={{ width: "100%", maxWidth: chatMax, borderRadius: 28, paddingVertical: 10, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ alignItems: "center", justifyContent: "center" }}>
              <Halo on={busy} size={46} color={c.pink} />
              <View style={{ width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: c.tint.pink }}>
                <Lu size={40} thinking={busy} cheer={cheer} />
              </View>
              <OnlineDot c={c} />
            </View>
            <View style={{ flex: 1 }}>
              <Text accessibilityRole="header" style={{ fontFamily: font.display, fontSize: L.fs(20), color: c.ink }}>Lu</Text>
              <Text numberOfLines={1} style={{ fontFamily: font.bold, fontSize: 12, color: busy ? c.accent : c.muted }}>
                {busy ? "Escribiendo…" : assistantOnline ? "Con Claude" : "Funciona sin conexión"}
              </Text>
            </View>
            {chat.some((m) => m.r === "a") && !busy && <IconBtn icon="document-text-outline" label="Resumir la conversación" size={40} onPress={() => send("", true)} />}
            {chat.length > 0 && !busy && <IconBtn icon="create-outline" label="Nueva conversación" size={40} onPress={() => { select(); restored.current = 0; setChat([]); }} />}
          </Glass>
        </View>

        {/* back to the latest message after scrolling up */}
        {farUp && chat.length > 0 && (
          <Animated.View entering={appear()} exiting={disappear} style={{ position: "absolute", bottom: 14, right: L.pad + 4 }}>
            <Press onPress={() => { select(); scroll.current?.scrollToEnd({ animated: true }); }} accessibilityLabel="Ir al último mensaje"
              style={[{ width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" }, raised(c, 2, c.solid), depth(c, 2)]}>
              <Ionicons name="arrow-down" size={20} color={c.accent} />
            </Press>
          </Animated.View>
        )}
      </View>

      {ios ? <SafeAreaView edges={kb ? [] : ["bottom"]}>{input}</SafeAreaView> : input}
    </KeyboardAvoidingView>
  );
}

/** The green "here for you" dot on Lu's avatar, with a slow soft pulse. */
function OnlineDot({ c }: { c: Palette }) {
  const still = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    t.value = withRepeat(withSequence(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), withDelay(1200, withTiming(0, { duration: 0 }))), -1);
    return () => cancelAnimation(t);
  }, [still]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.6 * (1 - t.value), transform: [{ scale: 1 + t.value * 1.2 }] }));
  return (
    <View pointerEvents="none" style={{ position: "absolute", right: 0, bottom: 2, width: 12, height: 12, alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={[{ position: "absolute", width: 12, height: 12, borderRadius: 6, backgroundColor: "#4CC38A" }, ring]} />
      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: "#4CC38A", borderWidth: 2, borderColor: c.solid }} />
    </View>
  );
}
