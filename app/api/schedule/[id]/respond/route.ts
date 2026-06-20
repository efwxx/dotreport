import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  computeGrid,
  colorForPlayer,
  loadSchedule,
  newResponseId,
  saveSchedule,
  scheduleExpiresAt,
  type Response as ScheduleResponse,
} from "@/lib/schedule";

export const dynamic = "force-dynamic";

function cookieNameFor(id: string): string {
  return `sched_${id}`;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const schedule = await loadSchedule(id);
  if (!schedule) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  const name = typeof b.name === "string" ? b.name.trim().slice(0, 60) : "";
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const answersInput =
    b.answers && typeof b.answers === "object"
      ? (b.answers as Record<string, unknown>)
      : {};
  const answers: Record<string, string> = {};
  for (const q of schedule.questions) {
    const v = answersInput[q.id];
    answers[q.id] = typeof v === "string" ? v.trim().slice(0, 500) : "";
  }

  const { slotsPerDay } = computeGrid(schedule);
  const total = slotsPerDay * schedule.dates.length;
  const rawPicks = Array.isArray(b.picks) ? b.picks : [];
  const pickSet = new Set<number>();
  for (const p of rawPicks) {
    const n = typeof p === "number" ? p : Number(p);
    if (Number.isInteger(n) && n >= 0 && n < total) pickSet.add(n);
  }
  const picks = [...pickSet].sort((a, b) => a - b);
  if (picks.length === 0) {
    return NextResponse.json(
      { error: "pick at least one timeslot" },
      { status: 400 },
    );
  }

  const cookieJar = await cookies();
  const cookieName = cookieNameFor(id);
  const existingId = cookieJar.get(cookieName)?.value;
  const existingIdx = existingId
    ? schedule.responses.findIndex((r) => r.id === existingId)
    : -1;

  let playerIndex: number;
  let responseId: string;
  if (existingIdx >= 0) {
    // Update existing entry. Keeps the same id and color.
    playerIndex = existingIdx;
    responseId = schedule.responses[existingIdx].id;
    const updated: ScheduleResponse = {
      id: responseId,
      name,
      submittedAt: new Date().toISOString(),
      answers,
      picks,
    };
    schedule.responses[existingIdx] = updated;
  } else {
    if (schedule.responses.length >= schedule.playerCount) {
      return NextResponse.json(
        { error: "this schedule is already full" },
        { status: 400 },
      );
    }
    playerIndex = schedule.responses.length;
    responseId = newResponseId();
    schedule.responses.push({
      id: responseId,
      name,
      submittedAt: new Date().toISOString(),
      answers,
      picks,
    });
  }

  await saveSchedule(schedule);

  const expires = scheduleExpiresAt(schedule);
  cookieJar.set(cookieName, responseId, {
    httpOnly: true,
    sameSite: "lax",
    path: `/schedule/${id}`,
    expires,
  });

  return NextResponse.json({
    ok: true,
    responseId,
    playerIndex,
    color: colorForPlayer(playerIndex),
    edited: existingIdx >= 0,
  });
}
