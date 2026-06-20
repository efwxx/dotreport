// Server-only storage + types for the site's OpenGraph embed config.
//
// One config file at data/og/config.json drives the og:image for the whole
// site. Uploaded image assets live at data/og/assets/{filename}. Editing the
// config is gated by OG_PASSWORD_HASH (falls back to SCHEDULE_PASSWORD_HASH
// so a fresh install only needs one secret).

import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import bcrypt from "bcryptjs";

const DATA_DIR = path.join(process.cwd(), "data", "og");
const ASSETS_DIR = path.join(DATA_DIR, "assets");
const CONFIG_FILE = path.join(DATA_DIR, "config.json");

// ---------- Types ----------

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

export type LayerBase = {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  blur: number;
  blend: BlendMode;
  hidden: boolean;
  locked: boolean;
};

// A field that's either a literal value or a reference to a runtime binding.
// e.g. { kind: "binding", value: "character.emblemBackgroundUrl" }
export type StringSource =
  | { kind: "literal"; value: string }
  | { kind: "binding"; value: string };

export type ImageLayer = LayerBase & {
  type: "image";
  source: StringSource;
  fit: "cover" | "contain" | "fill";
  cornerRadius: number;
  tint?: string;
  tintOpacity?: number;
};

export type TextLayer = LayerBase & {
  type: "text";
  content: StringSource;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  italic: boolean;
  color: string;
  align: "left" | "center" | "right";
  lineHeight: number;
  letterSpacing: number;
  maxLines: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
};

export type ShapeLayer = LayerBase & {
  type: "shape";
  shape: "rect" | "ellipse";
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius: number;
};

export type GradientLayer = LayerBase & {
  type: "gradient";
  angle: number;
  stops: Array<{ offset: number; color: string }>;
};

export type Layer = ImageLayer | TextLayer | ShapeLayer | GradientLayer;

// Site-wide embed config. No template ids, no creator tokens - there is one
// embed, and the password gates editing it.
export type OgConfig = {
  // Which configured account (1-based) the binding resolver pulls live data
  // from. Defaults to 1.
  account: number;
  // Canvas dimensions. Defaults to the OpenGraph sweet spot.
  width: number;
  height: number;
  background: string;
  layers: Layer[];
  // Filenames of uploaded assets sitting in data/og/assets/.
  assets: string[];
  updatedAt: string;
};

// ---------- IDs ----------

export function newLayerId(): string {
  return randomBytes(6).toString("hex");
}

// ---------- Password ----------

// Mirrors lib/schedule.ts:verifyPassword(). Reuses the schedule hash when an
// OG-specific one isn't set so deployments don't have to manage two secrets.
export async function verifyPassword(plain: string): Promise<boolean> {
  const hash =
    process.env.OG_PASSWORD_HASH ?? process.env.SCHEDULE_PASSWORD_HASH;
  if (!hash) return false;
  if (typeof plain !== "string" || plain.length === 0) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

export function isPasswordConfigured(): boolean {
  return Boolean(
    process.env.OG_PASSWORD_HASH ?? process.env.SCHEDULE_PASSWORD_HASH
  );
}

// ---------- Filesystem ----------

export function assetsDir(): string {
  return ASSETS_DIR;
}

export async function loadConfig(): Promise<OgConfig> {
  try {
    const raw = await readFile(CONFIG_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<OgConfig>;
    return {
      account: parsed.account ?? 1,
      width: parsed.width ?? 1200,
      height: parsed.height ?? 630,
      background: parsed.background ?? "#0a0a0b",
      layers: (parsed.layers ?? defaultLayers()) as Layer[],
      assets: parsed.assets ?? [],
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return defaultConfig();
    }
    throw err;
  }
}

export async function saveConfig(config: OgConfig): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
  const toWrite = { ...config, updatedAt: new Date().toISOString() };
  await writeFile(CONFIG_FILE, JSON.stringify(toWrite, null, 2));
}

// ---------- Defaults ----------

export function defaultConfig(): OgConfig {
  return {
    account: 1,
    width: 1200,
    height: 630,
    background: "#0a0a0b",
    layers: defaultLayers(),
    assets: [],
    updatedAt: new Date().toISOString(),
  };
}

// Starter layout for a fresh install: faded emblem background, gradient
// fade, emblem icon, display name, class+power subtitle.
export function defaultLayers(): Layer[] {
  return [
    {
      id: newLayerId(),
      type: "image",
      name: "Emblem background",
      x: 0,
      y: 0,
      width: 1200,
      height: 630,
      rotation: 0,
      opacity: 0.55,
      blur: 0,
      blend: "normal",
      hidden: false,
      locked: false,
      source: { kind: "binding", value: "character.emblemBackgroundUrl" },
      fit: "cover",
      cornerRadius: 0,
    },
    {
      id: newLayerId(),
      type: "gradient",
      name: "Bottom fade",
      x: 0,
      y: 0,
      width: 1200,
      height: 630,
      rotation: 0,
      opacity: 1,
      blur: 0,
      blend: "normal",
      hidden: false,
      locked: false,
      angle: 180,
      stops: [
        { offset: 0, color: "rgba(10,10,11,0.0)" },
        { offset: 1, color: "rgba(10,10,11,0.92)" },
      ],
    },
    {
      id: newLayerId(),
      type: "image",
      name: "Emblem icon",
      x: 64,
      y: 430,
      width: 96,
      height: 96,
      rotation: 0,
      opacity: 1,
      blur: 0,
      blend: "normal",
      hidden: false,
      locked: false,
      source: { kind: "binding", value: "character.emblemIconUrl" },
      fit: "cover",
      cornerRadius: 10,
    },
    {
      id: newLayerId(),
      type: "text",
      name: "Display name",
      x: 184,
      y: 432,
      width: 900,
      height: 70,
      rotation: 0,
      opacity: 1,
      blur: 0,
      blend: "normal",
      hidden: false,
      locked: false,
      content: { kind: "binding", value: "displayName" },
      fontFamily:
        "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Arial",
      fontSize: 56,
      fontWeight: 700,
      italic: false,
      color: "#ffffff",
      align: "left",
      lineHeight: 1.1,
      letterSpacing: -1,
      maxLines: 1,
      shadowColor: "rgba(0,0,0,0.6)",
      shadowBlur: 8,
      shadowOffsetX: 0,
      shadowOffsetY: 2,
    },
    {
      id: newLayerId(),
      type: "text",
      name: "Subtitle",
      x: 184,
      y: 504,
      width: 900,
      height: 36,
      rotation: 0,
      opacity: 0.85,
      blur: 0,
      blend: "normal",
      hidden: false,
      locked: false,
      content: { kind: "binding", value: "character.classLight" },
      fontFamily:
        "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Arial",
      fontSize: 24,
      fontWeight: 500,
      italic: false,
      color: "#cfcfd6",
      align: "left",
      lineHeight: 1.2,
      letterSpacing: 0.5,
      maxLines: 1,
    },
  ];
}

// ---------- Validators ----------

const BLEND_MODES: BlendMode[] = [
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

export function isValidBlend(v: unknown): v is BlendMode {
  return typeof v === "string" && (BLEND_MODES as string[]).includes(v);
}

// Defensive: sanity-check layer fields coming from the client. We don't want
// to trust the editor to never POST garbage (and the file ends up on disk,
// then back into the renderer).
export function sanitizeLayer(input: unknown): Layer | null {
  if (!input || typeof input !== "object") return null;
  const l = input as Record<string, unknown>;
  if (typeof l.type !== "string") return null;
  const base: LayerBase = {
    id: typeof l.id === "string" && l.id ? l.id : newLayerId(),
    name: typeof l.name === "string" ? l.name.slice(0, 80) : "Layer",
    x: numOr(l.x, 0),
    y: numOr(l.y, 0),
    width: Math.max(1, numOr(l.width, 100)),
    height: Math.max(1, numOr(l.height, 100)),
    rotation: numOr(l.rotation, 0),
    opacity: clamp(numOr(l.opacity, 1), 0, 1),
    blur: Math.max(0, numOr(l.blur, 0)),
    blend: isValidBlend(l.blend) ? l.blend : "normal",
    hidden: Boolean(l.hidden),
    locked: Boolean(l.locked),
  };
  switch (l.type) {
    case "image":
      return {
        ...base,
        type: "image",
        source: sanitizeStringSource(l.source),
        fit:
          l.fit === "contain" || l.fit === "fill" ? l.fit : "cover",
        cornerRadius: Math.max(0, numOr(l.cornerRadius, 0)),
        tint: typeof l.tint === "string" ? l.tint : undefined,
        tintOpacity:
          typeof l.tintOpacity === "number"
            ? clamp(l.tintOpacity, 0, 1)
            : undefined,
      };
    case "text":
      return {
        ...base,
        type: "text",
        content: sanitizeStringSource(l.content),
        fontFamily:
          typeof l.fontFamily === "string" && l.fontFamily
            ? l.fontFamily
            : "ui-sans-serif, system-ui, -apple-system, Arial",
        fontSize: clamp(numOr(l.fontSize, 32), 6, 400),
        fontWeight: clamp(numOr(l.fontWeight, 500), 100, 900),
        italic: Boolean(l.italic),
        color: typeof l.color === "string" ? l.color : "#ffffff",
        align:
          l.align === "center" || l.align === "right" ? l.align : "left",
        lineHeight: clamp(numOr(l.lineHeight, 1.2), 0.5, 4),
        letterSpacing: numOr(l.letterSpacing, 0),
        maxLines: clamp(Math.round(numOr(l.maxLines, 1)), 1, 20),
        shadowColor:
          typeof l.shadowColor === "string" ? l.shadowColor : undefined,
        shadowBlur:
          typeof l.shadowBlur === "number"
            ? Math.max(0, l.shadowBlur)
            : undefined,
        shadowOffsetX:
          typeof l.shadowOffsetX === "number" ? l.shadowOffsetX : undefined,
        shadowOffsetY:
          typeof l.shadowOffsetY === "number" ? l.shadowOffsetY : undefined,
      };
    case "shape":
      return {
        ...base,
        type: "shape",
        shape: l.shape === "ellipse" ? "ellipse" : "rect",
        fill: typeof l.fill === "string" ? l.fill : "#ffffff",
        stroke: typeof l.stroke === "string" ? l.stroke : "",
        strokeWidth: Math.max(0, numOr(l.strokeWidth, 0)),
        cornerRadius: Math.max(0, numOr(l.cornerRadius, 0)),
      };
    case "gradient": {
      const stops = Array.isArray(l.stops)
        ? l.stops
            .map((s) => {
              if (!s || typeof s !== "object") return null;
              const ss = s as Record<string, unknown>;
              if (typeof ss.color !== "string") return null;
              return {
                offset: clamp(numOr(ss.offset, 0), 0, 1),
                color: ss.color,
              };
            })
            .filter((s): s is { offset: number; color: string } => s !== null)
        : [];
      return {
        ...base,
        type: "gradient",
        angle: numOr(l.angle, 180),
        stops:
          stops.length >= 2
            ? stops
            : [
                { offset: 0, color: "rgba(0,0,0,0)" },
                { offset: 1, color: "rgba(0,0,0,0.9)" },
              ],
      };
    }
    default:
      return null;
  }
}

function sanitizeStringSource(input: unknown): StringSource {
  if (input && typeof input === "object") {
    const s = input as Record<string, unknown>;
    if (s.kind === "binding" && typeof s.value === "string") {
      return { kind: "binding", value: s.value };
    }
    if (s.kind === "literal" && typeof s.value === "string") {
      return { kind: "literal", value: s.value };
    }
  }
  return { kind: "literal", value: "" };
}

function numOr(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

// Sanitises a whole config patch. Returns the merged config with patched
// fields applied.
export function applyPatch(existing: OgConfig, patch: unknown): OgConfig {
  if (!patch || typeof patch !== "object") return existing;
  const p = patch as Record<string, unknown>;
  const next: OgConfig = { ...existing };
  if (typeof p.account === "number" && p.account >= 1 && p.account <= 8) {
    next.account = Math.round(p.account);
  }
  if (typeof p.width === "number" && p.width >= 100 && p.width <= 4096) {
    next.width = Math.round(p.width);
  }
  if (typeof p.height === "number" && p.height >= 100 && p.height <= 4096) {
    next.height = Math.round(p.height);
  }
  if (typeof p.background === "string") next.background = p.background;
  if (Array.isArray(p.layers)) {
    next.layers = p.layers
      .map((l) => sanitizeLayer(l))
      .filter((l): l is Layer => l !== null);
  }
  if (Array.isArray(p.assets)) {
    next.assets = p.assets
      .filter((a): a is string => typeof a === "string")
      .map((a) => path.basename(a));
  }
  return next;
}
