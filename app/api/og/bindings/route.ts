import { NextResponse } from "next/server";

import { loadConfig } from "@/lib/og";
import { resolveBindings } from "@/lib/og-bindings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Returns the resolved binding values for the configured account (override
// with ?account=N while previewing a different one). The editor calls this
// on mount so the live preview can substitute the same values the PNG route
// will use.
export async function GET(req: Request) {
  const config = await loadConfig();
  const url = new URL(req.url);
  const accountParam = Number(url.searchParams.get("account"));
  const accountIndex =
    Number.isFinite(accountParam) && accountParam >= 1 && accountParam <= 8
      ? Math.round(accountParam)
      : config.account;
  const values = await resolveBindings(accountIndex);
  return NextResponse.json({ account: accountIndex, values });
}
