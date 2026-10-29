import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Backdrop } from "../../src/components/Gradient";
import { AddOther, Btn, Card, Chips, IconBtn, Label, PainPicker, Press } from "../../src/components/ui";
import { CRAVE, MEDS, MOOD, SYM } from "../../src/content";
import { DayLog, emptyDay, periodAt, removePeriod, setEnd, setStart, State } from "../../src/cycle";
import { diff, fmt, fmtLong, today } from "../../src/dates";
import { success } from "../../src/feedback";
import { useStore } from "../../src/store";
import { depth, font, raised, sunken, tight, useLayout, useTheme } from "../../src/theme";

type ListKey = "sym" | "mood" | "crave";

export default function Day() {
  const c = useTheme();
  const L = useLayout();
  const { date } = useLocalSearchParams<{ date: string }>();
  const k = String(date) === "hoy" ? today() : String(date); // "hoy": the widgets' "Registrar" button
  const { S, update, toast } = useStore();
  const d: DayLog = S.days[k] ?? emptyDay();
  const p = periodAt(S, k);
  const future = k > today();
  const [confirmRemove, setConfirmRemove] = useState(false);

  const edit = (fn: (day: DayLog, s: State) => void) =>
    update((s) => { s.days[k] = s.days[k] ?? emptyDay(); fn(s.days[k], s); });
  const toggle = (g: ListKey, v: string) =>
    edit((day) => { day[g] = day[g].includes(v) ? day[g].filter((x) => x !== v) : [...day[g], v]; });
  const addCustom = (g: ListKey, v: string) =>
    update((s) => {
      if (![...SYM, ...MOOD, ...CRAVE, ...s.custom[g]].includes(v)) s.custom[g].push(v);
      s.days[k] = s.days[k] ?? emptyDay();
      if (!s.days[k][g].includes(v)) s.days[k][g].push(v);
    });
  const medOpts = [...new Set([...MEDS, ...(d.med.name && !MEDS.includes(d.med.name) ? [d.med.name] : [])])];

  const PeriodTile = ({ on, label, icon, onPress }: { on: boolean; label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) => (
    <View style={{ flex: 1 }}>
      <Press onPress={onPress} selected={on} feedback="none" accessibilityLabel={`${label}${on ? ", marcado" : ""}`}
        style={[{ paddingVertical: 16, alignItems: "center", gap: 6, borderWidth: 1.5 }, { borderRadius: 20 },
          on ? { backgroundColor: c.period, borderColor: c.period } : { backgroundColor: c.surface, borderColor: c.line }]}>
        <Ionicons name={icon} size={22} color={on ? c.onPeriod : c.periodDeep} />
        <Text style={{ fontFamily: font.bold, fontSize: 15, color: on ? c.onPeriod : c.ink }}>{label}</Text>
      </Press>
    </View>
  );

  const status = p ? `Día ${diff(p.start, k) + 1} de regla` : k === today() ? "Hoy" : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "android" ? "padding" : undefined}>
      <Backdrop />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: L.compact ? 14 : L.tablet ? 26 : 18, paddingBottom: 48, gap: L.compact ? 12 : 14, width: "100%", maxWidth: 720, alignSelf: "center" }}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>
        <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: c.line, alignSelf: "center" }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <View style={{ flexShrink: 1, gap: 4 }}>
            <Text accessibilityRole="header" style={[tight, { fontFamily: font.display, fontSize: L.fs(30), color: c.ink, textTransform: "capitalize", letterSpacing: -0.5 }]}>{fmtLong(k)}</Text>
            {status && (
              <View style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: p ? c.period : c.accentSoft,
                paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
                <Ionicons name={p ? "water" : "sunny"} size={13} color={p ? c.onPeriod : c.accent} />
                <Text style={{ fontFamily: font.bold, fontSize: 13, color: p ? c.onPeriod : c.accent }}>{status}</Text>
              </View>
            )}
          </View>
          <IconBtn icon="close" label="Cerrar" onPress={() => router.back()} color={c.ink} />
        </View>

        {future ? (
          <Card delay={0}><Text style={{ fontFamily: font.body, fontSize: 15, color: c.muted }}>Día futuro. Podrás registrarlo cuando llegue.</Text></Card>
        ) : (
          <>
            <Card delay={0}>
              <Label>Regla</Label>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <PeriodTile on={p?.start === k} label="Empieza" icon="water" onPress={() => { update((s) => setStart(s, k)); success(); toast("Inicio de regla marcado"); }} />
                <PeriodTile on={p?.end === k} label="Termina" icon="checkmark-circle" onPress={() => { update((s) => setEnd(s, k)); success(); toast("Fin de regla marcado"); }} />
              </View>
              {p && (confirmRemove ? (
                // Removing a whole period is the one destructive action here: ask once.
                <Animated.View entering={FadeIn.duration(150)} style={{ gap: 8 }}>
                  <Text style={{ fontFamily: font.bold, fontSize: 14, color: c.ink }}>¿Quitar la regla del {fmt(p.start)}{p.end ? ` al ${fmt(p.end)}` : ""}?</Text>
                  {/* "Cancelar" sits where "Quitar esta regla" was, so a double tap can't remove the period. */}
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <Btn small variant="soft" label="Cancelar" onPress={() => setConfirmRemove(false)} />
                    <Btn small label="Quitar" onPress={() => { update((s) => removePeriod(s, k)); setConfirmRemove(false); toast("Regla quitada"); }} />
                  </View>
                </Animated.View>
              ) : (
                <View style={{ alignSelf: "flex-start" }}><Btn small variant="soft" icon="trash-outline" label="Quitar esta regla" onPress={() => setConfirmRemove(true)} /></View>
              ))}
            </Card>

            <Card delay={0}>
              <Label>Dolor</Label>
              <PainPicker value={d.pain} onPick={(v) => edit((day) => { day.pain = day.pain === v ? null : v; })} />
            </Card>

            <Card delay={0}>
              <Label>Síntomas</Label>
              <Chips options={[...SYM, ...S.custom.sym]} selected={d.sym} onToggle={(v) => toggle("sym", v)} />
              <AddOther placeholder="Añadir otro" onAdd={(v) => addCustom("sym", v)} />
            </Card>

            <Card delay={0}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Label>Medicación</Label>
                <View style={{ flexDirection: "row", ...sunken(c), borderRadius: 999, padding: 3 }} accessibilityRole="radiogroup">
                  {[true, false].map((v) => (
                    <Press key={String(v)} selected={d.med.taken === v} feedback="select" accessibilityLabel={v ? "Sí tomé medicación" : "No tomé medicación"}
                      onPress={() => edit((day) => { day.med = { taken: v, name: v ? day.med.name : "" }; })}
                      style={[{ paddingHorizontal: 18, paddingVertical: 7, borderRadius: 999, backgroundColor: d.med.taken === v ? c.solid : "transparent" },
                        d.med.taken === v ? depth(c, 1) : null]}>
                      <Text style={{ fontFamily: font.bold, color: d.med.taken === v ? c.accent : c.muted }}>{v ? "Sí" : "No"}</Text>
                    </Press>
                  ))}
                </View>
              </View>
              {d.med.taken && (
                <Animated.View entering={FadeIn.duration(150)} style={{ gap: 12 }}>
                  <Chips options={medOpts} selected={[d.med.name]} onToggle={(v) => edit((day) => { day.med = { taken: true, name: day.med.name === v ? "" : v }; })} />
                  <AddOther placeholder="Otro medicamento" onAdd={(v) => edit((day) => { day.med = { taken: true, name: v }; })} />
                </Animated.View>
              )}
            </Card>

            <Card delay={0}>
              <Label>Cómo me siento</Label>
              <Chips options={[...MOOD, ...S.custom.mood]} selected={d.mood} onToggle={(v) => toggle("mood", v)} />
              <AddOther placeholder="Añadir otro" onAdd={(v) => addCustom("mood", v)} />
            </Card>

            <Card delay={0}>
              <Label>Antojos</Label>
              <Chips options={[...CRAVE, ...S.custom.crave]} selected={d.crave} onToggle={(v) => toggle("crave", v)} />
              <AddOther placeholder="Añadir otro" onAdd={(v) => addCustom("crave", v)} />
            </Card>

            <Btn full label="Listo" icon="checkmark" onPress={() => router.back()} />
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
