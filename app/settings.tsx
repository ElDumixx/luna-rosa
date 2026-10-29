import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Image, ScrollView, Switch, Text, View } from "react-native";
import { currentIcon, ICONS, iconStylesAvailable, setIcon } from "../src/appIcon";
import { Badge, Btn, Card, IconBtn, Label, Press } from "../src/components/ui";
import { mergePeriods } from "../src/cycle";
import { today } from "../src/dates";
import { connectHealth, healthAvailable, healthName, healthUnavailable, importFromHealth } from "../src/health";
import { askNotificationPermission } from "../src/reminders";
import { useStore } from "../src/store";
import { Backdrop } from "../src/components/Gradient";
import { select } from "../src/feedback";
import { font, tight, useLayout, useTheme } from "../src/theme";
import { WIDGET_CATALOG } from "../src/widgets/catalog";
import { makeSnapshot } from "../src/widgets/snapshot";

/**
 * Android: the widgets as they look now, each with a button that puts it on the home screen. A grid, not a sideways
 * scroller: the previews are native views that keep the swipe for themselves.
 */
function WidgetGallery() {
  const c = useTheme();
  const { S, toast } = useStore();
  const [w, setW] = useState(0);
  const { WidgetPreview, requestPinWidget } = require("react-native-android-widget");
  const { previewWidget } = require("../src/widgets/AndroidWidgets") as typeof import("../src/widgets/AndroidWidgets");
  const snap = makeSnapshot(S);
  // The native preview draws once: a new key when the data changes makes it draw again (it opens before the data loads).
  const version = JSON.stringify([snap, c.scheme]);
  const gap = 12, unit = (w - gap * 3) / 4; // a home screen is about four cells wide
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ flexDirection: "row", flexWrap: "wrap", gap, rowGap: 16 }}>
      {w > 0 && WIDGET_CATALOG.map((it) => {
        const width = Math.round(it.w * unit + (it.w - 1) * gap), height = Math.round(it.h * unit * 0.92 + (it.h - 1) * gap);
        return (
          <View key={it.name} style={{ width, gap: 8 }}>
            <WidgetPreview key={version} width={width} height={height} renderWidget={(size: { width: number; height: number }) => previewWidget(it.name, snap, size, c.scheme === "dark")} />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "space-between" }}>
              <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: font.bold, fontSize: 13, color: c.ink }}>{it.label}</Text>
              <Btn small variant="soft" label="Añadir" onPress={async () => {
                const ok = await requestPinWidget({ widgetName: it.name }).catch(() => false);
                if (!ok) toast("Mantén pulsada la pantalla de inicio → Widgets → Luna Rosa");
              }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Android: the icon styles, applied at once to the launcher. */
function IconPicker() {
  const c = useTheme();
  const { toast } = useStore();
  const [cur, setCur] = useState<string | null>(currentIcon());
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 14, justifyContent: "space-between" }}>
      {ICONS.map((ic) => {
        const on = cur === ic.name;
        return (
          // the cell sets the width: Press sizes to its content
          <View key={ic.label} style={{ width: "31%", alignItems: "center" }}>
          <Press feedback="select" selected={on} accessibilityLabel={`Icono ${ic.label}`} style={{ alignItems: "center", gap: 6 }}
            onPress={async () => {
              if (on) return;
              try { await setIcon(ic.name); setCur(ic.name); toast(`Icono ${ic.label}: aparecerá en unos segundos`); }
              catch { toast("No se pudo cambiar el icono"); }
            }}>
            <View style={{ padding: 3, borderRadius: 40, borderWidth: 2.5, borderColor: on ? c.accent : "transparent" }}>
              <Image source={ic.preview} style={{ width: 64, height: 64, borderRadius: 32 }} />
            </View>
            <Text numberOfLines={1} style={{ fontFamily: font.bold, fontSize: 12, color: on ? c.accent : c.muted }}>{ic.label}</Text>
          </Press>
          </View>
        );
      })}
    </View>
  );
}

export default function Settings() {
  const c = useTheme();
  const L = useLayout();
  const { S, update, reset, toast } = useStore();
  const [canHealth, setCanHealth] = useState<boolean | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => { healthAvailable().then(setCanHealth); }, []);

  const toggleHealth = async (on: boolean) => {
    if (!on) { update((s) => { s.settings.healthSync = false; }); return; }
    setWorking(true);
    const ok = await connectHealth();
    if (!ok) { setWorking(false); toast(`No se pudo conectar con ${healthName}`); return; }
    let added = 0;
    try {
      const got = await importFromHealth();
      added = mergePeriods(JSON.parse(JSON.stringify(S)), got.periods); // count only; the update below applies it
      update((s) => {
        mergePeriods(s, got.periods);
        s.health.written = [...new Set([...s.health.written, ...got.markers])];
        s.health.lastImport = today();
        s.settings.healthSync = true;
      });
    } catch { update((s) => { s.settings.healthSync = true; }); }
    setWorking(false);
    toast(added ? `${added} reglas importadas de ${healthName}` : `Conectado con ${healthName}`);
  };

  const toggleRemind = async (on: boolean) => {
    if (on && !(await askNotificationPermission())) { toast("Activa las notificaciones en Ajustes del móvil"); return; }
    update((s) => { s.settings.remind = on; });
  };

  const Row = ({ icon, title, sub, value, onChange, disabled }: { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <Badge icon={icon} size={40} tone={icon === "heart" ? "pink" : icon === "notifications" ? "peach" : icon === "pause" ? "lilac" : "mint"} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontFamily: font.bold, fontSize: 15, color: c.ink }}>{title}</Text>
        <Text style={{ fontFamily: font.body, fontSize: 13, color: c.muted }}>{sub}</Text>
      </View>
      <Switch value={value} onValueChange={(v) => { select(); onChange(v); }} disabled={disabled} trackColor={{ true: c.accent, false: c.p0 }} thumbColor="#fff" accessibilityLabel={title} />
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: L.compact ? 14 : L.tablet ? 26 : 18, gap: 14, paddingBottom: 48, width: "100%", maxWidth: 720, alignSelf: "center" }}>
        <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: c.line, alignSelf: "center" }} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text accessibilityRole="header" style={[tight, { fontFamily: font.display, fontSize: 30, color: c.ink, letterSpacing: -0.5 }]}>Ajustes</Text>
          <IconBtn icon="close" label="Cerrar" onPress={() => router.back()} color={c.ink} />
        </View>

        <Card delay={0}>
          <Row icon="heart" title={`Conectar con ${healthName}`}
            sub={canHealth === false ? healthUnavailable : working ? "Conectando…" : "Importa tus reglas y guarda allí lo que registres (días de regla y dolor)."}
            value={S.settings.healthSync} onChange={toggleHealth} disabled={!canHealth || working} />
        </Card>

        <Card delay={0} style={{ gap: 18 }}>
          <Row icon="notifications" title="Recordatorio" sub="Un aviso cuando tu regla suele llegar, según tus ciclos." value={S.settings.remind} onChange={toggleRemind} />
          <Row icon="pause" title="Pausar previsiones" sub="Por embarazo, pérdida, anticonceptivos o lo que sea. Sin preguntas."
            value={S.settings.paused} onChange={(v) => update((s) => { s.settings.paused = v; })} />
        </Card>

        {iconStylesAvailable && (
          <>
            <Card delay={0} style={{ gap: 12 }}>
              <Label>Icono de la app</Label>
              <IconPicker />
              <Text style={{ fontFamily: font.body, fontSize: 12, color: c.muted }}>
                Todos se adaptan a la forma de icono de tu móvil y a los iconos temáticos de Android. Cristal imita un cristal esmerilado. Al cambiarlo, Android cierra la app un momento.
              </Text>
            </Card>
            <Card delay={0} style={{ gap: 12 }}>
              <Label>Widgets</Label>
              <WidgetGallery />
              <Text style={{ fontFamily: font.body, fontSize: 12, color: c.muted }}>Se ponen en modo oscuro con tu móvil y se actualizan solos cada hora.</Text>
            </Card>
          </>
        )}

        <Text style={{ fontFamily: font.body, fontSize: 13, color: c.muted, paddingHorizontal: 4 }}>
          Sin avisos de salud automáticos ni artículos en tu pantalla. Tus datos se guardan solo en tu móvil{S.settings.healthSync ? ` y en ${healthName}` : ""}.
        </Text>

        {confirmWipe ? (
          <Card level={1} style={{ borderWidth: 1.5, borderColor: c.period }}>
            <Text style={{ fontFamily: font.bold, color: c.ink }}>¿Borrar todos tus registros de Luna Rosa?</Text>
            <Text style={{ fontFamily: font.body, fontSize: 13, color: c.muted }}>Lo que ya esté en {healthName} se queda allí.</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Btn small variant="soft" label="Cancelar" onPress={() => setConfirmWipe(false)} />
              <Btn small label="Borrar" onPress={() => { reset(); setConfirmWipe(false); toast("Datos borrados"); }} />
            </View>
          </Card>
        ) : (
          <Btn variant="soft" icon="trash-outline" label="Borrar mis datos" onPress={() => setConfirmWipe(true)} />
        )}
      </ScrollView>
    </View>
  );
}
