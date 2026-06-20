import { NextResponse } from "next/server";
import path from "node:path";
import { readFile } from "node:fs/promises";

import { createCanvas, loadImage as napiLoadImage } from "@napi-rs/canvas";

// Side-effect import: registers the bundled font files with @napi-rs/canvas
// so ctx.font can resolve Inter / Manrope / Jost / etc. Has to run before
// the first draw call.
import "@/lib/og-fonts";

import { assetsDir, loadConfig } from "@/lib/og";
import { resolveBindings } from "@/lib/og-bindings";
import {
  drawTemplate,
  prepareRender,
  type ImageLoader,
  type RenderImage,
} from "@/lib/og-render";

export const dynamic = "force-dynamic";
// Force the Node runtime - @napi-rs/canvas is a native module and can't
// run on the edge.
export const runtime = "nodejs";

// PNG render of the site's OG embed, with live data bindings resolved at
// request time. Public + cacheable: Discord, Twitter, etc. crawl this
// directly when they fetch the embed.
export async function GET() {
  const config = await loadConfig();
  const bindings = await resolveBindings(config.account);

  const canvas = createCanvas(config.width, config.height);
  // @napi-rs/canvas's SKRSContext2D is API-compatible with the DOM
  // CanvasRenderingContext2D for everything our renderer touches. The cast
  // hops the type-level gap (napi doesn't ship DOM types).
  const ctx2d = canvas.getContext("2d") as unknown as CanvasRenderingContext2D;

  const loadImage: ImageLoader = async (src: string) => {
    if (!src) return null;
    try {
      // Server-relative asset URL. Read straight from disk - faster than
      // re-fetching ourselves and avoids host-header issues in local dev.
      const assetMatch = src.match(/^\/api\/og\/assets\/(.+)$/i);
      if (assetMatch) {
        const filePath = path.join(assetsDir(), path.basename(assetMatch[1]));
        const buf = await readFile(filePath);
        const img = await napiLoadImage(buf);
        return img as unknown as RenderImage;
      }
      const img = await napiLoadImage(src);
      return img as unknown as RenderImage;
    } catch {
      return null;
    }
  };

  try {
    const prepared = await prepareRender(config, bindings, loadImage);
    drawTemplate(ctx2d, prepared);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `render failed: ${message}` },
      { status: 500 }
    );
  }

  const png = await canvas.encode("png");
  return new Response(new Uint8Array(png), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      // Cache for 5 minutes; Discord/Twitter typically re-fetch on each post.
      "Cache-Control":
        "public, max-age=300, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
