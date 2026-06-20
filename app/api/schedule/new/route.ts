import { NextResponse } from "next/server";

import {
  isValidDate,
  isValidPlayerCount,
  isValidSlotSize,
  isValidTime,
  newCreatorToken,
  newQuestionId,
  newScheduleId,
  saveSchedule,
  verifyPassword,
  type Schedule,
} from "@/lib/schedule";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
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

  const password = typeof b.password === "string" ? b.password : "";
  if (!(await verifyPassword(password))) {
    return NextResponse.json({ error: "wrong password" }, { status: 401 });
  }

  const title = typeof b.title === "string" ? b.title.trim() : "";
  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  const note = typeof b.note === "string" ? b.note.trim().slice(0, 280) : "";

  const dates = Array.isArray(b.dates) ? b.dates.filter(isValidDate) : [];
  if (dates.length === 0 || dates.length > 60) {
    return NextResponse.json(
      { error: "pick between 1 and 60 dates" },
      { status: 400 },
    );
  }
  // Remove duplicates, keep order.
  const seen = new Set<string>();
  const uniqDates: string[] = [];
  for (const d of dates) {
    if (!seen.has(d)) {
      seen.add(d);
      uniqDates.push(d);
    }
  }

  if (!isValidTime(b.startTime) || !isValidTime(b.endTime)) {
    return NextResponse.json({ error: "invalid time" }, { status: 400 });
  }
  if (!isValidSlotSize(b.slotMinutes)) {
    return NextResponse.json({ error: "invalid slot size" }, { status: 400 });
  }
  if (!isValidPlayerCount(b.playerCount)) {
    return NextResponse.json(
      { error: "player count must be 2..12" },
      { status: 400 },
    );
  }

  const questionPrompts = Array.isArray(b.questions)
    ? (b.questions as unknown[])
        .map((q) => (typeof q === "string" ? q.trim() : ""))
        .filter((q) => q.length > 0)
        .slice(0, 10)
    : [];
  const questions = questionPrompts.map((prompt) => ({
    id: newQuestionId(),
    prompt,
  }));

  const schedule: Schedule = {
    id: newScheduleId(),
    creatorToken: newCreatorToken(),
    title,
    note: note || undefined,
    dates: uniqDates,
    startTime: b.startTime,
    endTime: b.endTime,
    slotMinutes: b.slotMinutes,
    playerCount: b.playerCount,
    questions,
    responses: [],
    createdAt: new Date().toISOString(),
  };
  await saveSchedule(schedule);

  return NextResponse.json({
    id: schedule.id,
    creatorToken: schedule.creatorToken,
    shareUrl: `/schedule/${schedule.id}`,
    creatorUrl: `/schedule/${schedule.id}?token=${schedule.creatorToken}`,
  });
}
