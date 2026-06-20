import { NextResponse } from "next/server";
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";

import { assetsDir, loadConfig, saveConfig, verifyPassword } from "@/lib/og";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

// Public asset fetch. The napi renderer at /api/og/image reads files
// directly from disk, but external consumers (or the browser preview) still
// hit this.
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ name: string }> }
) {
  const { name } = await ctx.params;
  // Defense-in-depth: strip any "../" the URL parser somehow let through.
  const safeName = path.basename(name);
  const ext = path.extname(safeName).toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) {
    return NextResponse.json({ error: "bad type" }, { status: 400 });
  }
  try {
    const buf = await readFile(path.join(assetsDir(), safeName));
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        // Assets are immutable once uploaded; uploading a new file always
        // produces a new filename, so aggressive cache is safe.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}

// Password-gated delete. Removes from disk and from the config's asset list.
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ name: string }> }
) {
  const password = req.headers.get("x-og-password") ?? "";
  if (!(await verifyPassword(password))) {
    return NextResponse.json({ error: "wrong password" }, { status: 401 });
  }
  const { name } = await ctx.params;
  const safeName = path.basename(name);
  try {
    await unlink(path.join(assetsDir(), safeName));
  } catch {
    // Asset already gone - treat as success so the editor UI converges.
  }
  const existing = await loadConfig();
  const next = {
    ...existing,
    assets: existing.assets.filter((a) => a !== safeName),
  };
  await saveConfig(next);
  return NextResponse.json({ ok: true });
}
