import { cookies } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import { computeGrid, loadSchedule } from "@/lib/schedule";

import { CreatorView } from "./CreatorView";
import { RespondentView } from "./RespondentView";
import { SummaryView } from "./SummaryView";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const schedule = await loadSchedule(id).catch(() => null);
  return { title: schedule ? schedule.title : "schedule" };
}

export default async function SchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const schedule = await loadSchedule(id);
  if (!schedule) notFound();

  const tokenRaw = sp.token;
  const token = Array.isArray(tokenRaw) ? tokenRaw[0] : tokenRaw;
  const isCreator = Boolean(token) && token === schedule.creatorToken;

  const viewRaw = sp.view;
  const view = Array.isArray(viewRaw) ? viewRaw[0] : viewRaw;

  const grid = computeGrid(schedule);

  // Cookie identifies a returning player.
  const cookieJar = await cookies();
  const myResponseId = cookieJar.get(`sched_${id}`)?.value ?? null;
  const myResponse = myResponseId
    ? schedule.responses.find((r) => r.id === myResponseId) ?? null
    : null;

  // Pick which view to render.
  let mode: "creator" | "summary" | "form";
  if (isCreator) mode = "creator";
  else if (view === "edit") mode = "form";
  else if (myResponse) mode = "summary";
  else mode = "form";

  return (
    <main className="page">
      <div className="sched-header">
        <Link href="/" className="sched-back">
          ← home
        </Link>
        <h1 className="sched-title">{schedule.title}</h1>
        {schedule.note ? <p className="sched-note">{schedule.note}</p> : null}
      </div>

      {mode === "creator" ? (
        <CreatorView
          schedule={{
            id: schedule.id,
            title: schedule.title,
            dates: schedule.dates,
            slotMinutes: schedule.slotMinutes,
            playerCount: schedule.playerCount,
            questions: schedule.questions,
            responses: schedule.responses,
          }}
          rowLabels={grid.rowLabels}
          slotsPerDay={grid.slotsPerDay}
        />
      ) : mode === "summary" && myResponse ? (
        <SummaryView
          schedule={{
            id: schedule.id,
            dates: schedule.dates,
            playerCount: schedule.playerCount,
            responses: schedule.responses,
          }}
          myResponseId={myResponse.id}
          rowLabels={grid.rowLabels}
          slotsPerDay={grid.slotsPerDay}
        />
      ) : (
        <RespondentView
          schedule={{
            id: schedule.id,
            dates: schedule.dates,
            slotMinutes: schedule.slotMinutes,
            playerCount: schedule.playerCount,
            questions: schedule.questions,
            responseCount: schedule.responses.length,
          }}
          rowLabels={grid.rowLabels}
          slotsPerDay={grid.slotsPerDay}
          existing={
            myResponse
              ? {
                  name: myResponse.name,
                  answers: myResponse.answers,
                  picks: myResponse.picks,
                }
              : null
          }
        />
      )}
    </main>
  );
}
