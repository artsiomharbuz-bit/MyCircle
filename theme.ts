// The app chrome is mostly monochrome, with a small set of semantic accents.
// Two full palettes (dark/light) live here; which one is active comes from
// ThemeContext.tsx, not from this file directly.
//
// A couple of key names don't literally match their color anymore, because
// they describe a *role* that flips between themes rather than a fixed
// color: `white` is "the primary foreground color" (real white on dark mode,
// near-black on light mode) and `black` is "whatever contrasts with `white`"
// (near-black on dark mode, real white on light mode) — they're always each
// other's opposite. `red`/`coral` are the accent pair — both live in the same
// warm red/coral family (no purple/blue anywhere in the app's accent system)
// so cursors, secondary CTAs and active-state tints all read as one brand
// color, with `red` reserved for the heavier/destructive end of that range.
// Brand palette: Paper #F6F4F1, Stone #E4DED2, Coral #F95C4B, Black #000000.
// Light mode uses them directly (Paper page, Stone cards, Black text and
// primary buttons, Coral accent). Dark mode is the same family inverted:
// warm near-black surfaces, Paper text and Paper primary buttons, same Coral.
export const darkColors = {
  background: '#0C0B0A',
  white: '#F6F4F1',
  black: '#0C0B0A',
  red: '#E5432F',
  coral: '#F95C4B',
  accentText: '#ffffff',
  yellow: '#f5c542',
  inputBackground: '#1B1917',
  buttonSecondary: '#33302C',
  backButtonBackground: '#25221F',
  // Primary controls use the inverse surface in each theme.
  buttonBackground: '#F6F4F1',
  buttonText: '#000000',
  textMuted: 'rgba(246,244,241,0.5)',
  textLink: 'rgba(246,244,241,0.7)',
  placeholder: 'rgba(246,244,241,0.4)',
  border: 'rgba(246,244,241,0.12)',
  errorText: '#F2B8B0',
};

export const lightColors: Colors = {
  background: '#F6F4F1',
  white: '#000000',
  black: '#F6F4F1',
  red: '#E5432F',
  coral: '#F95C4B',
  accentText: '#ffffff',
  yellow: '#f5c542',
  inputBackground: '#E4DED2',
  buttonSecondary: '#D3CCBD',
  backButtonBackground: '#E4DED2',
  buttonBackground: '#000000',
  buttonText: '#F6F4F1',
  textMuted: 'rgba(0,0,0,0.5)',
  textLink: 'rgba(0,0,0,0.7)',
  placeholder: 'rgba(0,0,0,0.4)',
  border: 'rgba(60,45,30,0.14)',
  errorText: '#A32B1C',
};

// Fixed dark tokens for full-bleed media surfaces (camera, editor, clips,
// story stage, text tool). These sit on top of arbitrary photo/video, so they
// never follow the app theme or the brand palette above.
export const mediaColors: Colors = {
  background: '#141416',
  white: '#ffffff',
  black: '#111111',
  red: '#E5432F',
  coral: '#F95C4B',
  accentText: '#ffffff',
  yellow: '#f5c542',
  inputBackground: '#1c1c1e',
  buttonSecondary: '#3a3a3c',
  backButtonBackground: '#2c2c2e',
  buttonBackground: '#000000',
  buttonText: '#ffffff',
  textMuted: 'rgba(255,255,255,0.45)',
  textLink: 'rgba(255,255,255,0.65)',
  placeholder: 'rgba(255,255,255,0.4)',
  border: 'rgba(255,255,255,0.12)',
  errorText: '#d4d4d8',
};

export type Colors = typeof darkColors;

// --- Design tokens -----------------------------------------------------
// One shared scale for spacing, radii, type and elevation so every screen
// is built out of the same handful of values instead of ad-hoc numbers.
// Web mirrors these (see myspace-web/src/index.css) so the two platforms
// read as one product even though layouts differ.

export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

// xs/sm/md/lg/xl size static surfaces (cards, media, sheets, tiles).
// `button` is the corner radius for tappable action buttons (Follow,
// Continue, Save, Message, form submits, …) — a moderate rounded-rect
// rather than a fully-round pill, so buttons read as squared-off, confident
// shapes instead of capsules. Truly circular controls (avatars, icon-only
// round buttons, toggle knobs, dots, badges) still use height / 2 rather
// than a token, since their radius is derived from a height that varies by
// control — `pill` remains available for the rare case that genuinely
// wants a full capsule.
export const radius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  sheet: 28,
  button: 14,
  // Text inputs: a square field with slightly softened corners.
  input: 10,
  pill: 999,
} as const;

// Poppins (Regular 400 / SemiBold 600 / Bold 700) is the one UI face — the scale below leans
// Regular/Bold) — the scale below leans on size + color for hierarchy
// rather than faking intermediate weights. `display` uses Oswald, the one
// already-bundled display face (also used in the text tool), reserved for
// the handful of hero moments — onboarding headlines, welcome, empty big
// states — so the brand has a distinct voice without re-typesetting every
// label in the app.
export const typography = {
  display: { fontSize: 34, lineHeight: 40, fontFamily: 'Poppins_700Bold' },
  h1: { fontSize: 24, lineHeight: 30, fontFamily: 'Poppins_600SemiBold' },
  h2: { fontSize: 20, lineHeight: 26, fontFamily: 'Poppins_600SemiBold' },
  h3: { fontSize: 17, lineHeight: 22, fontFamily: 'Poppins_600SemiBold' },
  body: { fontSize: 15, lineHeight: 21, fontFamily: 'Poppins_400Regular' },
  bodyBold: { fontSize: 15, lineHeight: 21, fontFamily: 'Poppins_600SemiBold' },
  callout: { fontSize: 14, lineHeight: 20, fontFamily: 'Poppins_400Regular' },
  calloutBold: { fontSize: 14, lineHeight: 20, fontFamily: 'Poppins_600SemiBold' },
  footnote: { fontSize: 13, lineHeight: 18, fontFamily: 'Poppins_400Regular' },
  caption: { fontSize: 12, lineHeight: 16, fontFamily: 'Poppins_400Regular' },
  micro: { fontSize: 11, lineHeight: 14, fontFamily: 'Poppins_600SemiBold' },
} as const;

export type TypographyVariant = keyof typeof typography;

// Three tiers, used verbatim by any surface that needs to lift off the
// background. Dark mode reads a drop shadow as a soft lift; on light mode
// the same dark shadow reads as a smudge, so callers on light surfaces
// should skip elevation rather than reach for a lighter version of it.
export const elevation = {
  low: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 10,
    elevation: 4,
  },
  high: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

// Shared spring presets so every tap/pop/reveal in the app moves with the
// same weight instead of each screen inventing its own feel.
export const motion = {
  duration: { fast: 120, base: 200, slow: 320 },
  springSnappy: { speed: 20, bounciness: 8 },
  springSoft: { speed: 14, bounciness: 4 },
} as const;

// A curated, on-brand set of avatar-fallback gradients — each a tight
// two-stop analogous pair rooted in the app's own accent hues, replacing a
// larger grab-bag of unrelated rainbow stops that read as generic/AI-ish.
export const gradientPalette: [string, string][] = [
  ['#E5432F', '#F95C4B'],
  ['#6d28d9', '#a855f7'],
  ['#0ea5e9', '#22d3ee'],
  ['#f59e0b', '#f97316'],
  ['#10b981', '#34d399'],
  ['#ec4899', '#f43f5e'],
  ['#3f3f46', '#18181b'],
];

export function randomGradient(): [string, string] {
  return gradientPalette[Math.floor(Math.random() * gradientPalette.length)];
}

// Circles reference an accent by key (not a resolved color) since the actual
// color depends on which theme is active — resolve with `colors[colorKey]`.
export type Circle = { id: string; label: string; colorKey: 'red' | 'coral' | 'yellow' };

export const circles: Circle[] = [
  { id: 'all', label: 'All', colorKey: 'red' },
  { id: 'best-friends', label: 'Best Friends', colorKey: 'yellow' },
];

// The post text-color picker is a creative tool, not app chrome — its swatch
// options stay fixed regardless of the app's own theme, and unlike the rest
// of the app's monochrome palette, this one deliberately spans real color.
export const textToolColors = [
  '#ffffff',
  '#000000',
  '#a1a1aa',
  '#3f3f46',
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#eab308',
  '#84cc16',
  '#22c55e',
  '#10b981',
  '#14b8a6',
  '#06b6d4',
  '#0ea5e9',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#d946ef',
  '#ec4899',
  '#f43f5e',
];

export type TextToolFont = { key: string; label: string; fontFamily?: string };

export const textToolFonts: TextToolFont[] = [
  { key: 'classic', label: 'Classic', fontFamily: 'Poppins_600SemiBold' },
  { key: 'industrial', label: 'Industrial', fontFamily: 'Poppins_700Bold' },
  { key: 'rounded', label: 'Rounded', fontFamily: 'Fredoka_600SemiBold' },
  { key: 'handwriting', label: 'Handwriting', fontFamily: 'Caveat_700Bold' },
  { key: 'condensed', label: 'Condensed', fontFamily: 'BebasNeue_400Regular' },
  { key: 'marker', label: 'Marker', fontFamily: 'PermanentMarker_400Regular' },
  { key: 'script', label: 'Script', fontFamily: 'Pacifico_400Regular' },
  { key: 'impact', label: 'Impact', fontFamily: 'Anton_400Regular' },
  { key: 'block', label: 'Block', fontFamily: 'ArchivoBlack_400Regular' },
];
