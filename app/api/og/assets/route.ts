import { NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

import { assetsDir, loadConfig, saveConfig, verifyPassword } from "@/lib/og";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Max upload size per asset. Big enough to comfortably handle a high-res
// background photo or a multi-megapixel emblem mockup while still keeping a
// hard ceiling on what one upload can consume on disk.
const MAX_BYTES = 15 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

const EXTENSIONS: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

// Upload a picture for the embed. Password-gated multipart with field `file`.
// Returns the URL the editor should set on the image layer's source.
export async function POST(req: Request) {
  const password = req.headers.get("x-og-password") ?? "";
  if (!(await verifyPassword(password))) {
    return NextResponse.json({ error: "wrong password" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid multipart" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "missing file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `file too large (max ${MAX_BYTES} bytes)` },
      { status: 413 }
    );
  }
  const type = file.type || "image/png";
  if (!ALLOWED_TYPES.has(type)) {
    return NextResponse.json(
      { error: `unsupported type ${type}` },
      { status: 415 }
    );
  }

  const ext = EXTENSIONS[type] ?? ".bin";
  const filename = `${randomBytes(6).toString("hex")}${ext}`;
  const dir = assetsDir();
  await mkdir(dir, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, filename), buf);

  // Track in the config so the editor's asset gallery can re-list previous
  // uploads on a future session.
  const existing = await loadConfig();
  const next = {
    ...existing,
    assets: [...existing.assets, filename],
  };
  await saveConfig(next);

  return NextResponse.json({
    filename,
    url: `/api/og/assets/${filename}`,
  });
}
