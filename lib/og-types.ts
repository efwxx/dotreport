// Client-safe type definitions and constants for OG templates. Mirrors
// lib/og.ts but contains no fs/bcrypt imports so client components can
// import factories + enums without dragging Node-only code into the bundle.

export type BlendMode =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "darken"
  | "lighten"
  | "color-dodge"
  | "color-burn"
  | "hard-light"
  | "soft-light"
  | "difference"
  | "exclusion"
  | "hue"
  | "saturation"
  | "color"
  | "luminosity";

export const BLEND_MODES: BlendMode[] = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "hard-light",
  "soft-light",
  "difference",
  "exclusion",
  "hue",
  "saturation",
  "color",
  "luminosity",
];

export const DEFAULT_FONT =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Arial";

// Curated font picker. Each entry's `stack` is the actual font-family string
// the renderer + browser preview use; we keep the prepended display family
// (e.g. "Futura") first so a macOS host with the real proprietary font
// installed still uses it before falling back to our bundled lookalike.
//
// Mirrored on the server by lib/og-fonts.ts which registers the TTF files
// with @napi-rs/canvas under the same family names listed in `family`.
export type FontFamily = {
  label: string;
  // Comma-separated font-family string. Used directly as ctx.font's family
  // portion + the editor's CSS font-family.
  stack: string;
};

export const FONT_FAMILIES: FontFamily[] = [
  {
    label: "System default",
    stack:
      "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Arial",
  },
  {
    label: "Inter",
    stack: "Inter, ui-sans-serif, system-ui, sans-serif",
  },
  {
    label: "Manrope",
    stack: "Manrope, ui-sans-serif, system-ui, sans-serif",
  },
  {
    label: "Plus Jakarta Sans",
    stack: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif",
  },
  {
    // Real Futura on hosts that have it (macOS, designers' machines), Jost as
    // a free Futura-inspired fallback everywhere else (which is what we
    // actually bundle).
    label: "Futura (Jost fallback)",
    stack: "Futura, Jost, ui-sans-serif, system-ui, sans-serif",
  },
  {
    label: "Montserrat",
    stack: "Montserrat, ui-sans-serif, system-ui, sans-serif",
  },
];

// ---------- Binding catalogue ----------
//
// Mirrors the catalogue in lib/og-bindings.ts (which is the server-only file
// that actually resolves bindings against live data). Duplicated here so
// client components can show the binding picker without importing the
// server-side Bungie/Last.fm modules.

export type BindingKind = "string" | "image";

export type BindingDef = {
  key: string;
  label: string;
  group: "Guardian" | "Loadout" | "Now playing" | "Account";
  kind: BindingKind;
  example?: string;
};

export const BINDINGS: BindingDef[] = [
  { key: "displayName", label: "Display name", group: "Account", kind: "string", example: "Yura" },
  { key: "bungieTag", label: "Bungie tag", group: "Account", kind: "string", example: "Yura#0618" },
  { key: "character.className", label: "Class name", group: "Guardian", kind: "string", example: "Hunter" },
  { key: "character.classLight", label: "Class + power", group: "Guardian", kind: "string", example: "Hunter · 2010" },
  { key: "character.power", label: "Power level", group: "Guardian", kind: "string", example: "2010" },
  { key: "character.emblemBackgroundUrl", label: "Emblem (cinematic)", group: "Guardian", kind: "image" },
  { key: "character.emblemIconUrl", label: "Emblem (icon)", group: "Guardian", kind: "image" },
  { key: "loadout.kinetic.iconUrl", label: "Kinetic icon", group: "Loadout", kind: "image" },
  { key: "loadout.kinetic.name", label: "Kinetic name", group: "Loadout", kind: "string" },
  { key: "loadout.energy.iconUrl", label: "Energy icon", group: "Loadout", kind: "image" },
  { key: "loadout.energy.name", label: "Energy name", group: "Loadout", kind: "string" },
  { key: "loadout.power.iconUrl", label: "Power icon", group: "Loadout", kind: "image" },
  { key: "loadout.power.name", label: "Power name", group: "Loadout", kind: "string" },
  { key: "loadout.exoticArmor.iconUrl", label: "Exotic armor icon", group: "Loadout", kind: "image" },
  { key: "loadout.exoticArmor.name", label: "Exotic armor name", group: "Loadout", kind: "string" },
  { key: "loadout.subclass.iconUrl", label: "Subclass icon", group: "Loadout", kind: "image" },
  { key: "loadout.subclass.name", label: "Subclass name", group: "Loadout", kind: "string" },
  { key: "nowPlaying.title", label: "Track title", group: "Now playing", kind: "string" },
  { key: "nowPlaying.artist", label: "Track artist", group: "Now playing", kind: "string" },
  { key: "nowPlaying.album", label: "Track album", group: "Now playing", kind: "string" },
  { key: "nowPlaying.artUrl", label: "Album art", group: "Now playing", kind: "image" },
];

// Cheap browser-safe id generator. Used by the editor when the user adds a
// new layer; the server has its own randomBytes-based variant in lib/og.ts.
export function clientId(): string {
  // randomUUID is supported everywhere we care about, and we slice to keep
  // ids visually manageable in the layer panel's debug output. Falls back to
  // Math.random in the (extremely unlikely) case crypto is missing.
  const c =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  return c.replace(/-/g, "").slice(0, 12);
}
