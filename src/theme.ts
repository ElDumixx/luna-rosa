// "Pétalo" design system: flat pastel surfaces on a blush page, symmetric shapes, a soft serif for titles.
// Shapes, one per role so they don't repeat: circles for small markers (icon badges, days), evenly rounded
// rectangles for cards and tiles, pills for actions and choices (buttons, chips, the selected tab).
// Pastel pink leads; peach, lilac and mint mark the cycle phases. Surfaces are opaque with one soft shadow:
// no translucency, sheens or stacked shadows, which keeps every screen cheap to draw on both platforms.
import { Platform, TextStyle, useColorScheme, useWindowDimensions, ViewStyle } from "react-native";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Easing, FadeIn, FadeInDown, FadeInLeft, FadeInRight, FadeOut, ZoomIn } from "react-native-reanimated";

export type Tone = "pink" | "peach" | "lilac" | "mint";

const light = {
  bg: "#FFF7F9", ink: "#3A1F2D", muted: "#86677A", faint: "#BFA7B4",
  // cards are opaque white; `soft` is the pale blush used for wells and quiet fills
  surface: "#FFFFFF", solid: "#FFFFFF", line: "#F1DDE6", edge: "#F4E4EB",
  soft: "#FFEFF4", accent: "#C2457A", accent2: "#7E5CCB", accentSoft: "#FCE1EA", onAccent: "#FFFFFF",
  /** the brand's pastel pink */
  pink: "#F7BFD0",
  // period days are pastel pink with dark text (readable, and calmer than a saturated red)
  period: "#F4A6C0", periodDeep: "#B23A6A", periodSoft: "#FCE1EA", onPeriod: "#3A1F2D", pred: "#FFF0F4",
  // cycle phases (approximate, shown only once the cycle is learned): pastel fill + a deep shade for text and icons
  phase: { period: "#F4A6C0", follicular: "#FFCDB2", ovulation: "#CDBBFF", luteal: "#B5E3D2" },
  phaseDeep: { period: "#B23A6A", follicular: "#A8542B", ovulation: "#5E44B8", luteal: "#2C7A61" },
  /** pastel tints for badges and tiles, each with its deep shade */
  tint: { pink: "#FCE1EA", peach: "#FFE6D6", lilac: "#ECE4FF", mint: "#DDF3EA" } as Record<Tone, string>,
  tintDeep: { pink: "#B23A6A", peach: "#A8542B", lilac: "#5E44B8", mint: "#2C7A61" } as Record<Tone, string>,
  aurora: ["#F9C9D7", "#FFDCC8", "#E3D6FF"] as readonly string[],
  p0: "#F3E6EC", p1: "#F8C5D5", p2: "#EE8FB0", p3: "#C2457A",
  shadow: "#7A3557", glassTint: "rgba(255,240,246,0.35)", scheme: "light" as "light" | "dark",
  hi: "rgba(255,255,255,0.9)", sheen: ["rgba(255,255,255,0.6)", "rgba(255,255,255,0.08)"] as readonly string[], well: "#FBEEF2",
};
const dark: typeof light = {
  bg: "#150D12", ink: "#FBEFF4", muted: "#C7AABA", faint: "#806775",
  surface: "#221820", solid: "#221820", line: "#33242E", edge: "#2E212A",
  soft: "#2A1B25", accent: "#F49BBE", accent2: "#BBA4F5", accentSoft: "#3A2331", onAccent: "#2A1321",
  pink: "#F2A9C2",
  period: "#E98AAD", periodDeep: "#F7B7CC", periodSoft: "#3A2331", onPeriod: "#2A1321", pred: "#2A1B25",
  phase: { period: "#E98AAD", follicular: "#E3A783", ovulation: "#A994EC", luteal: "#7FBFA9" },
  phaseDeep: { period: "#F7B7CC", follicular: "#FFCDB2", ovulation: "#D9CCFF", luteal: "#BDE8D8" },
  tint: { pink: "#3A2331", peach: "#3A2A22", lilac: "#2D2640", mint: "#1F3129" },
  tintDeep: { pink: "#F7B7CC", peach: "#FFCDB2", lilac: "#D9CCFF", mint: "#BDE8D8" },
  aurora: ["#4A2236", "#4A3024", "#33284F"],
  p0: "#3A2A33", p1: "#6E3A52", p2: "#C45E89", p3: "#F49BBE",
  shadow: "#000000", glassTint: "rgba(60,30,45,0.35)", scheme: "dark",
  hi: "rgba(255,255,255,0.08)", sheen: ["rgba(255,255,255,0.05)", "rgba(255,255,255,0)"], well: "#1C131A",
};
export type Palette = typeof light;

export function useTheme(): Palette {
  return useColorScheme() === "dark" ? dark : light;
}

export const font = {
  /** titles and big numbers: a soft, rounded serif */
  display: "Fraunces_600SemiBold",
  /** the wordmark, quotes and accents */
  displayMed: "Fraunces_600SemiBold_Italic",
  italic: "Fraunces_600SemiBold_Italic",
  body: "Nunito_600SemiBold",
  bold: "Nunito_800ExtraBold",
};

export const painColor = (c: Palette, p: number) => [c.p0, c.p1, c.p2, c.p3][p] ?? c.p0;

/** Real Liquid Glass (iOS 26+). Elsewhere the same places use opaque surfaces. */
export const liquidGlass = Platform.OS === "ios" && (() => { try { return isLiquidGlassAvailable(); } catch { return false; } })();

/** "#RRGGBB" → "rgba(r,g,b,a)". */
export const alpha = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

/** One soft shadow that grows with the level. A single layer: cheaper to draw than stacked ones. */
const shadow = (c: Palette, level: 1 | 2 | 3, color = c.shadow) => {
  const k = color === "#000000" ? 2.2 : 1;
  const y = [0, 6, 12, 18][level], blur = [0, 18, 30, 40][level];
  return `0px ${y}px ${blur}px -${Math.round(blur / 2)}px ${alpha(color, [0, 0.14, 0.2, 0.26][level] * k)}`;
};

/** Soft shadow drawn natively (boxShadow), identical on iOS and Android. */
export const depth = (c: Palette, level: 1 | 2 | 3 = 1, color = c.shadow): ViewStyle => ({ boxShadow: shadow(c, level, color) });

/** The web version (the PWA) draws its surfaces as Liquid Glass. */
export const webGlass = Platform.OS === "web";

/**
 * Liquid Glass for the web: a translucent pane that blurs and saturates what's behind it (the pastel page),
 * with a bright rim along the top edge, a soft sheen and the usual shadow. `strong`: more opaque, for bars that
 * float over text. Safari gets the -webkit- prefix from react-native-web.
 */
export const glass = (c: Palette, level: 1 | 2 | 3 = 1, strong = false): ViewStyle => {
  const dark = c.scheme === "dark";
  return {
    // very see-through: the blur behind keeps text readable
    backgroundColor: dark ? `rgba(44,26,37,${strong ? 0.4 : 0.24})` : `rgba(255,255,255,${strong ? 0.38 : 0.2})`,
    backgroundImage: `linear-gradient(170deg, rgba(255,255,255,${dark ? 0.07 : 0.32}), rgba(255,255,255,0) 40%)`,
    borderWidth: 1, borderColor: dark ? "rgba(255,255,255,0.13)" : "rgba(255,255,255,0.8)",
    boxShadow: `${shadow(c, level)}, inset 0px 1px 1px ${dark ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.95)"}, inset 0px -1px 2px rgba(255,255,255,${dark ? 0.04 : 0.4})`,
    // not in React Native's types; react-native-web passes it to CSS
    ...({ backdropFilter: `blur(${strong ? 26 : 20}px) saturate(${dark ? 160 : 200}%)` } as object),
  };
};

/** Fill of small controls (chips, pain tiles): white, or a thin film of glass on the web. */
export const pane = (c: Palette) => webGlass ? (c.scheme === "dark" ? "rgba(255,255,255,0.05)" : "rgba(255,255,255,0.25)") : c.surface;

/** A card: opaque fill, a hairline edge and one soft shadow (Liquid Glass on the web). */
export const raised = (c: Palette, level: 1 | 2 | 3 = 1, fill = c.surface): ViewStyle =>
  webGlass && (fill === c.surface || fill === c.solid) ? glass(c, level) : {
    backgroundColor: fill, borderWidth: 1, borderColor: c.edge, boxShadow: shadow(c, level),
  };

/** A quiet well (tracks, segmented controls): a flat blush fill. */
export const sunken = (c: Palette): ViewStyle => ({ backgroundColor: c.well });

/** A solid accent fill (primary buttons, the selected tab): flat color and, from level 2, a colored shadow. */
export const glossy = (c: Palette, color = c.accent, level: 1 | 2 = 2): ViewStyle => ({
  backgroundColor: color, ...(level === 2 ? { boxShadow: `0px 8px 18px -10px ${alpha(color === c.accent && c.scheme === "dark" ? "#000000" : color, 0.7)}` } : null),
});

/** Corner radius of tiles inside a card (and of small cards): a step below the card's own radius. */
export const tileRadius = (cardRadius: number) => Math.max(14, cardRadius - 8);

/** Android adds extra space above/below custom fonts; drop it so numbers and titles sit like on iOS. */
export const tight: TextStyle = Platform.OS === "android" ? { includeFontPadding: false } : {};

/**
 * Lively but light motion. Things answer what the person did (a tap, a new message, a choice) with a short
 * spring, and a few small touches of ambient life (Lu breathing, the page's pastel discs drifting, today's pulse
 * on the ring) run slowly on the UI thread: transforms and opacity only, never layout, so they cost almost nothing.
 * With Reduce Motion on, Reanimated skips entrances and the ambient loops stop.
 */
const ease = Easing.out(Easing.cubic);
export const motion = {
  fast: 150, base: 220, slow: 400, ease,
  /** springs that settle without overshooting */
  press: { damping: 30, stiffness: 420, mass: 0.6 },
  settle: { damping: 28, stiffness: 240, mass: 1 },
};
// On the web, Reanimated's layout animations leave cards out of place, so the web version enters without them.
const web = Platform.OS === "web";
/** Standard entrance: a short fade with a small lift. Delays are capped so nothing waits long. */
export const enter = (delay = 0) => web ? undefined :
  FadeInDown.delay(Math.min(delay, 200)).springify().damping(20).stiffness(170).withInitialValues({ opacity: 0, transform: [{ translateY: 16 }] });
export const appear = (delay = 0) => web ? undefined : FadeIn.duration(motion.base).delay(Math.min(delay, 120));
export const disappear = web ? undefined : FadeOut.duration(motion.fast);
/** Springy entrance with a hint of bounce, for things that just arrived (messages, chosen items). */
export const pop = (delay = 0, from: "down" | "left" | "right" = "down") => web ? undefined :
  (from === "left" ? FadeInLeft : from === "right" ? FadeInRight : FadeInDown).delay(Math.min(delay, 480)).springify().damping(17).stiffness(190);
/** A small thing popping into place (a check mark, a selected icon). */
export const bloom = (delay = 0) => web ? undefined : ZoomIn.delay(delay).springify().damping(12).stiffness(260);

export type SizeClass = "small" | "regular" | "large" | "tablet";
const SCALE: Record<SizeClass, number> = { small: 0.92, regular: 1, large: 1.06, tablet: 1.12 };

/**
 * Layout numbers that adapt to the window, from small Androids (320 dp) through Pro Max phones
 * and large Androids (420+) to iPads and Android tablets, in portrait and landscape.
 * - `size`: small < 360 ≤ regular < 420 ≤ large; tablet when the short side is ≥ 600.
 * - `wide` (≥ 700) switches screens to two columns, `xwide` (≥ 1100, iPad landscape) to three.
 * - `fs(n)` scales a font size or a component size for the size class.
 */
export function useLayout() {
  const { width, height } = useWindowDimensions();
  const tablet = Math.min(width, height) >= 600;
  const compact = width < 360;
  const size: SizeClass = tablet ? "tablet" : compact ? "small" : width >= 420 ? "large" : "regular";
  const wide = width >= 700;
  const xwide = width >= 1100;
  const max = xwide ? 1280 : wide ? 1040 : 640;
  const pad = compact ? 14 : tablet ? (wide ? 32 : 24) : size === "large" ? 20 : 18;
  const gap = compact ? 12 : tablet ? 20 : 16;
  const inner = Math.min(width - pad * 2, max);
  const short = height < 500; // phone in landscape
  const k = SCALE[size];
  const fs = (n: number) => Math.round(n * k);
  const radius = tablet ? 32 : compact ? 24 : 28;
  return { width, height, size, compact, large: size === "large", wide, xwide, tablet, short, landscape: width > height, max, pad, gap, inner, fs, radius };
}
