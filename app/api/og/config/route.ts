import { NextResponse } from "next/server";

import { applyPatch, loadConfig, saveConfig, verifyPassword } from "@/lib/og";

export const dynamic = "force-dynamic";

// Public read - the editor preview loads it without auth so the page paints
// instantly. Editing requires the password in the x-og-password header.
export async function GET() {
  const config = await loadConfig();
  return NextResponse.json(config);
}

// Replace the config with a sanitised patch. The password is sent as a
// header rather than in the body so it doesn't survive in request logs or
// surrounding form state.
export async function PATCH(req: Request) {
  const password = req.headers.get("x-og-password") ?? "";
  if (!(await verifyPassword(password))) {
    return NextResponse.json({ error: "wrong password" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const existing = await loadConfig();
  const next = applyPatch(existing, body);
  await saveConfig(next);
  return NextResponse.json(next);
}
