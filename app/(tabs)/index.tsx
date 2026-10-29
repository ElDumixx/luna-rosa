import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import React, { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { CycleChart } from "../../src/components/CycleChart";
import { CycleOrb } from "../../src/components/CycleOrb";
import { LuTip } from "../../src/components/LuTip";
import { PhaseBar } from "../../src/components/PhaseBar";
import { Columns, Screen } from "../../src/components/Screen";
import { Badge, Btn, Card, CardHead, Chip, IconBtn, Label, PainPicker, Press } from "../../src/components/ui";
import { WeekStrip } from "../../src/components/WeekStrip";
import { MOOD, PAIN } from "../../src/content";
import { emptyDay, periodAt, setEnd, setStart, State } from "../../src/cycle";
import { add, diff, DIA, fmt, MESL, today } from "../../src/dates";
import { success } from "../../src/feedback";
import { useStore } from "../../src/store";
import { appear, font, Palette, raised, tileRadius, tight, Tone, useLayout, useTheme } from "../../src/theme";

type IconName = keyof typeof Ionicons.glyphMap;

/** Most frequent value of a list field across all logged days. */
const top = (S: State, f: "sym" | "mood" | "crave") => {
  const n: Record<string, number> = {};
  Object.values(S.days).forEach((d) => d[f].forEach((v) => (n[v] = (n[v] ?? 0) + 1)));
  return Object.entries(n).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
};

export default function Home() {
  const c = useTheme();
  const L = useLayout();
  const { S, update, toast, ci } = useStore();
  const T = today();
  const ongoing = periodAt(S, T);
  const d = new Date();
  const todayLog = S.days[T];

  const markStart = () => { update((s) => setStart(s, T)); success(); toast("Inicio de regla marcado"); };
  const markEnd = () => { update((s) => setEnd(s, T)); success(); toast("Fin de regla marcado"); };
  const toggleMood = (m: string) => update((s) => {
    const day = (s.days[T] = s.days[T] ?? emptyDay());
    day.mood = day.mood.includes(m) ? day.mood.filter((x) => x !== m) : [...day.mood, m];
  });

  // --- one gentle question, never a diagnosis ---
  let banner: { icon: IconName; text: string; actions: React.ReactNode } | null = null;
  if (S.settings.paused) {
    banner = { icon: "pause-circle", text: "Previsiones en pausa", actions: <Btn small label="Reanudar" onPress={() => update((s) => { s.settings.paused = false; })} /> };
  } else if (ci.win && !ongoing && S.settings.remind && S.dismissed !== T) {
    if (T >= ci.win.start && T <= add(ci.win.end, 7)) {
      banner = { icon: "water", text: "¿Te ha bajado la regla?", actions: <>
        <Btn small label="Sí, hoy" onPress={markStart} />
        <Btn small variant="soft" label="Aún no" onPress={() => update((s) => { s.dismissed = T; })} />
      </> };
    } else if (T > add(ci.win.end, 7)) {
      banner = { icon: "time", text: "Este ciclo va más largo que tu rango. Estrés, viajes o cambios de sueño lo alteran a menudo.", actions: <>
        <Btn small label="Registrar" onPress={() => router.push(`/day/${T}`)} />
        <Btn small variant="soft" label="Pausar" onPress={() => update((s) => { s.settings.paused = true; })} />
      </> };
    }
  }

  let status = "", sub = "";
  if (!ci.last) { status = "Marca tu última regla"; sub = "Con 2 reglas aprendo tu ciclo."; }
  else if (ongoing) {
    status = `Día ${diff(ongoing.start, T) + 1} de regla`;
    sub = !ongoing.end ? `Suele durar ${ci.dur} días` : ongoing.end === T ? "Último día" : `Hasta el ${fmt(ongoing.end)}`;
  } else if (S.settings.paused) { status = "Previsiones en pausa"; }
  else if (!ci.win) { status = "Aprendiendo tu ciclo"; sub = "Registra una regla más"; }
  else {
    const toMid = diff(T, ci.win.mid);
    status = toMid > 0 ? `Próxima regla en ~${toMid} días` : toMid === 0 ? "Tu regla podría llegar hoy" : `${-toMid} días más tarde de lo habitual`;
    sub = `Entre el ${fmt(ci.win.start)} y el ${fmt(ci.win.end)}`;
  }

  const actions = !ci.last ? (
    <><View style={{ flex: 1 }}><Btn full label="Empezó hoy" icon="water" onPress={markStart} /></View>
      <View style={{ flex: 1 }}><Btn full variant="soft" label="Elegir día" onPress={() => router.navigate("/calendar")} /></View></>
  ) : ongoing && !ongoing.end ? (
    <><View style={{ flex: 1 }}><Btn full label="Terminó hoy" icon="checkmark" onPress={markEnd} /></View>
      <View style={{ flex: 1 }}><Btn full variant="soft" label="Otro día" onPress={() => router.navigate("/calendar")} /></View></>
  ) : null;

  // Smaller while there is nothing to draw on the ring yet.
  const orbSize = (L.short ? 170 : { small: 186, regular: 224, large: 248, tablet: 272 }[L.size]) * (ci.last ? 1 : 0.8);
  const hero = (
    <Card tone="hero" level={3} delay={0} style={{ alignItems: "center", paddingVertical: L.tablet ? 32 : 24, gap: L.tablet ? 20 : 16 }}>
      <Press onPress={() => router.navigate("/calendar")} scaleTo={0.98} accessibilityLabel="Abrir calendario">
        <CycleOrb day={ci.dayOf} len={ci.typical ?? 28} dur={ci.dur} size={orbSize} learned={!!ci.typical} />
      </Press>
      <View style={{ alignItems: "center", gap: 4 }}>
        <Text maxFontSizeMultiplier={1.3} style={[tight, { fontFamily: font.display, fontSize: L.fs(25), color: c.ink, textAlign: "center", letterSpacing: -0.3 }]}>{status}</Text>
        {!!sub && <Text style={{ fontFamily: font.bold, fontSize: L.fs(14), color: c.muted, textAlign: "center" }}>{sub}</Text>}
      </View>
      {actions && <View style={{ flexDirection: "row", gap: 10, alignSelf: "stretch", maxWidth: 480, width: "100%" }}>{actions}</View>}
    </Card>
  );

  const checkin = (
    <Card delay={80}>
      <CardHead icon="heart" tone="pink" title="¿Cómo estás hoy?" right={<Btn small variant="soft" icon="create-outline" label={L.compact ? "Más" : "Registrar"}onPress={() => router.push(`/day/${T}`)} />} />
      <PainPicker value={todayLog?.pain ?? null} onPick={(v) => {
        const next = todayLog?.pain === v ? null : v;
        update((s) => { s.days[T] = s.days[T] ?? emptyDay(); s.days[T].pain = next; });
        toast(next == null ? "Dolor borrado" : `Dolor: ${PAIN[v]}`);
      }} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {MOOD.slice(0, 6).map((m) => <Chip key={m} label={m} on={!!todayLog?.mood.includes(m)} onPress={() => toggleMood(m)} />)}
      </View>
    </Card>
  );

  const insights = useMemo(() => [
    { icon: "sync" as IconName, tone: "lilac" as Tone, big: ci.typical ? (ci.lo === ci.hi ? `${ci.typical} d` : `${ci.lo}–${ci.hi} d`) : "—", small: "Ciclo típico" },
    { icon: "water" as IconName, tone: "pink" as Tone, big: ci.last ? `${ci.dur} días` : "—", small: "Duración de la regla" },
    { icon: "pulse" as IconName, tone: "peach" as Tone, big: ci.pain != null ? PAIN[Math.round(ci.pain)] : "—", small: "Dolor medio" },
    { icon: "flower-outline" as IconName, tone: "mint" as Tone, big: top(S, "sym") ?? "—", small: "Síntoma más frecuente" },
    { icon: "happy-outline" as IconName, tone: "peach" as Tone, big: top(S, "mood") ?? "—", small: "Ánimo más frecuente" },
  ], [S, ci]);

  // Phones: a carousel that bleeds to the screen edges. Wide screens: a grid that fills its column.
  const tileW = L.compact ? 132 : L.large ? 158 : 146;
  const carousel = L.wide ? (
    <View style={{ gap: 10 }}>
      <View style={{ paddingHorizontal: 4 }}><Label>Tus datos</Label></View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {insights.map((x, i) => <Insight key={x.small} c={c} {...x} i={i} w="47%" grow row />)}
      </View>
    </View>
  ) : (
    <View style={{ gap: 10 }}>
      <View style={{ paddingHorizontal: 4 }}><Label>Tus datos</Label></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={tileW + 12} decelerationRate="fast"
        contentContainerStyle={{ gap: 12, paddingHorizontal: L.pad, paddingVertical: 8 }} style={{ marginHorizontal: -L.pad, marginVertical: -4 }}>
        {insights.map((x, i) => <Insight key={x.small} c={c} {...x} i={i} w={tileW} />)}
      </ScrollView>
    </View>
  );

  const chart = (
    <Card delay={120}>
      <CardHead icon="stats-chart" tone="mint" title="Tus ciclos" />
      <Text style={{ fontFamily: font.bold, fontSize: L.fs(12), color: c.muted, marginTop: -4 }}>Franja: 21–35 días, rango habitual</Text>
      <CycleChart lens={ci.lens} />
    </Card>
  );

  return (
    <Screen brand label={`${DIA[d.getDay()]} ${d.getDate()} de ${MESL[d.getMonth()]}`} title="Luna Rosa"
      right={<IconBtn icon="settings-outline" label="Ajustes" onPress={() => router.push("/settings")} />}>
      {banner && (
        <Card delay={0} level={2} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
          <Badge icon={banner.icon} tone="pink" size={L.fs(40)} />
          <View style={{ flex: 1, gap: 10 }}>
            <Text style={{ fontFamily: font.bold, color: c.ink, fontSize: L.fs(15) }}>{banner.text}</Text>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>{banner.actions}</View>
          </View>
        </Card>
      )}
      {/* three columns on iPad landscape; on two columns the chart moves left so both sides end at a similar height */}
      {L.xwide
        ? <Columns ratio={1.15} left={<>{hero}<LuTip ci={ci} onPeriod={!!ongoing} delay={60} /><WeekStrip delay={40} /></>} right={<>{checkin}<PhaseBar ci={ci} delay={120} /></>} third={<>{carousel}{chart}</>} />
        : <Columns ratio={1.1} left={<>{hero}<LuTip ci={ci} onPeriod={!!ongoing} delay={60} /><WeekStrip delay={40} />{L.wide && chart}</>} right={<>{checkin}<PhaseBar ci={ci} delay={120} />{carousel}{!L.wide && chart}</>} />}
    </Screen>
  );
}

/** One figure from the data. Phones: a tall tile for the carousel. Wide screens (`row`): badge beside the text. */
function Insight({ c, icon, tone, big, small, i, w, grow, row }: { c: Palette; icon: IconName; tone: Tone; big: string; small: string; i: number; w: number | `${number}%`; grow?: boolean; row?: boolean }) {
  const L = useLayout();
  return (
    <Animated.View entering={appear(80 + i * 20)}
      style={[{ width: w, flexGrow: grow ? 1 : 0, padding: L.tablet ? 16 : 14, gap: row ? 12 : 10,
        flexDirection: row ? "row" : "column", alignItems: row ? "center" : "stretch" }, raised(c, 1), { borderRadius: tileRadius(L.radius) }]}
      accessible accessibilityLabel={`${small}: ${big === "—" ? "sin datos" : big}`}>
      <Badge icon={icon} tone={tone} size={L.fs(row ? 40 : 34)} />
      <View style={{ flexShrink: 1, gap: row ? 2 : 8 }}>
        <Text maxFontSizeMultiplier={1.2} numberOfLines={1} adjustsFontSizeToFit style={[tight, { fontFamily: font.display, fontSize: L.fs(22), color: c.ink }]}>{big}</Text>
        <Text numberOfLines={2} style={{ fontFamily: font.bold, fontSize: L.fs(12), color: c.muted }}>{small}</Text>
      </View>
    </Animated.View>
  );
}
