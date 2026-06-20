import { NextResponse } from "next/server";

import { verifyPassword } from "@/lib/og";

export const dynamic = "force-dynamic";

// Used solely by the editor's unlock screen. Returns ok/error without
// touching the config so a wrong password produces a clean 401 instead of
// a confusing save failure.
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const password =
    body && typeof body === "object" && "password" in body
      ? String((body as Record<string, unknown>).password ?? "")
      : "";
  if (!(await verifyPassword(password))) {
    return NextResponse.json({ error: "wrong password" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
