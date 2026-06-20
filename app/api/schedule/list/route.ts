import { NextResponse } from "next/server";

import { listSchedules, verifyPassword } from "@/lib/schedule";

export const dynamic = "force-dynamic";

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

  const schedules = await listSchedules();
  return NextResponse.json({
    schedules: schedules.map((s) => ({
      id: s.id,
      title: s.title,
      createdAt: s.createdAt,
      dates: s.dates,
      playerCount: s.playerCount,
      responseCount: s.responses.length,
      shareUrl: `/schedule/${s.id}`,
      creatorUrl: `/schedule/${s.id}?token=${s.creatorToken}`,
    })),
  });
}
