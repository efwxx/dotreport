import { NextResponse } from "next/server";

import { defaultConfig, saveConfig, verifyPassword } from "@/lib/og";

export const dynamic = "force-dynamic";

// Replace the saved config with a fresh default layout. Same auth as PATCH
// /api/og/config since this is just an opinionated overwrite.
export async function POST(req: Request) {
  const password = req.headers.get("x-og-password") ?? "";
  if (!(await verifyPassword(password))) {
    return NextResponse.json({ error: "wrong password" }, { status: 401 });
  }
  const next = defaultConfig();
  await saveConfig(next);
  return NextResponse.json(next);
}
