// Registers our bundled fonts with @napi-rs/canvas so the PNG renderer can
// resolve them by family name. Importing this module triggers the
// registration as a side effect; the PNG route imports it once at the top
// of its file so it's ready before any draw call.
//
// Each TTF here is a variable font (weight axis only, except Inter which
// also carries opsz). Skia resolves the weight axis from ctx.font's weight
// number, so a single file covers every weight we need.
//
// We intentionally do NOT register italics. The Skia renderer synthesises a
// slant for italic text well enough at typical OG sizes, and avoiding the
// italic .ttfs keeps the bundle smaller.

import path from "node:path";

import { GlobalFonts } from "@napi-rs/canvas";

// Idempotency guard: module evaluation can fire twice in dev when the route
// is hot-reloaded, and GlobalFonts.registerFromPath happily double-registers
// (which seems harmless but spams the family map). One-shot flag avoids it.
let registered = false;

const FONT_FILES: Array<{ file: string; family: string }> = [
  { file: "Inter.ttf", family: "Inter" },
  { file: "Manrope.ttf", family: "Manrope" },
  { file: "PlusJakartaSans.ttf", family: "Plus Jakarta Sans" },
  // Jost ships under its own family name so consumers can pick it directly;
  // the `"Futura"` family in the editor's font stack falls through to Jost
  // on hosts without real Futura installed.
  { file: "Jost.ttf", family: "Jost" },
  { file: "Montserrat.ttf", family: "Montserrat" },
];

export function registerFonts(): void {
  if (registered) return;
  registered = true;
  const dir = path.join(process.cwd(), "public", "fonts");
  for (const { file, family } of FONT_FILES) {
    try {
      GlobalFonts.registerFromPath(path.join(dir, file), family);
    } catch (err) {
      // Don't crash the route if a font file is missing - we'd rather render
      // with the Skia fallback than 500 the entire embed.
      // eslint-disable-next-line no-console
      console.warn(
        `[og-fonts] failed to register ${family}:`,
        err instanceof Error ? err.message : err
      );
    }
  }
}

// Auto-run on import. Routes only need to `import "@/lib/og-fonts"` to make
// every family available.
registerFonts();
