"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";

import { colorForPlayer } from "@/lib/schedule-colors";

interface Props {
  schedule: {
    id: string;
    dates: string[];
    playerCount: number;
    responses: {
      id: string;
      name: string;
      submittedAt: string;
      picks: number[];
    }[];
  };
  myResponseId: string;
  rowLabels: string[];
  slotsPerDay: number;
}

function formatDateHeader(iso: string): { weekday: string; day: string } {
  const d = new Date(iso + "T12:00:00");
  return {
    weekday: d.toLocaleDateString(undefined, { weekday: "short" }),
    day: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  };
}

function formatSlotLabel(
  slot: number,
  slotsPerDay: number,
  dates: string[],
  rowLabels: string[],
): string {
  const dateIdx = Math.floor(slot / slotsPerDay);
  const rowIdx = slot % slotsPerDay;
  const h = formatDateHeader(dates[dateIdx] ?? "");
  return `${h.weekday} ${h.day} · ${rowLabels[rowIdx] ?? ""}`;
}

export function SummaryView({
  schedule,
  myResponseId,
  rowLabels,
  slotsPerDay,
}: Props) {
  const myIdx = schedule.responses.findIndex((r) => r.id === myResponseId);
  const myColor = myIdx >= 0 ? colorForPlayer(myIdx) : "#8a8a93";

  const dateHeaders = useMemo(
    () => schedule.dates.map(formatDateHeader),
    [schedule.dates],
  );

  // slot index -> list of players who picked it.
  const playersBySlot = useMemo(() => {
    const m = new Map<number, number[]>();
    schedule.responses.forEach((r, i) => {
      for (const p of r.picks) {
        const arr = m.get(p) ?? [];
        arr.push(i);
        m.set(p, arr);
      }
    });
    return m;
  }, [schedule.responses]);

  const consensus = useMemo(() => {
    let best: { slot: number; count: number } | null = null;
    for (const [slot, players] of playersBySlot) {
      if (!best || players.length > best.count) {
        best = { slot, count: players.length };
      }
    }
    return best;
  }, [playersBySlot]);

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const myPicks = useMemo(() => {
    const r = schedule.responses[myIdx];
    return new Set(r?.picks ?? []);
  }, [schedule.responses, myIdx]);

  function slotIndex(dateIdx: number, rowIdx: number) {
    return dateIdx * slotsPerDay + rowIdx;
  }

  // Used to scale cell darkness. Min 1 to avoid divide by zero.
  const respCount = Math.max(1, schedule.responses.length);

  return (
    <>
      <div className="sched-card">
        <div className="sched-color-card">
          <span
            className="sched-swatch sched-swatch-lg"
            style={{ background: myColor }}
          />
          <span>
            <strong>{schedule.responses[myIdx]?.name ?? "you"}</strong>
            <span className="sched-muted">
              {" "}your picks are saved. you can change them any time.
            </span>
          </span>
        </div>
        <div className="sched-actions">
          <Link
            href={`/schedule/${schedule.id}?view=edit`}
            className="sched-btn"
          >
            edit my picks
          </Link>
        </div>
      </div>

      <div className="sched-card">
        <div className="sched-creator-meta">
          <span className="sched-muted">
            {schedule.responses.length} of {schedule.playerCount} player
            {schedule.playerCount === 1 ? "" : "s"} locked in
          </span>
        </div>

        <div className="sched-roster">
          {schedule.responses.map((r, i) => (
            <span
              key={r.id}
              className={
                "sched-roster-chip" +
                (r.id === myResponseId ? " sched-roster-me" : "")
              }
            >
              <span
                className="sched-swatch"
                style={{ background: colorForPlayer(i) }}
              />
              <span>{r.name}</span>
            </span>
          ))}
          {Array.from({
            length: Math.max(
              0,
              schedule.playerCount - schedule.responses.length,
            ),
          }).map((_, i) => (
            <span
              key={"empty-" + i}
              className="sched-roster-chip sched-roster-empty"
            >
              <span
                className="sched-swatch sched-swatch-empty"
                style={{
                  color: colorForPlayer(schedule.responses.length + i),
                }}
              />
              <span className="sched-muted">open</span>
            </span>
          ))}
        </div>

        {consensus && consensus.count >= 2 ? (
          <p className="sched-muted sched-hint">
            most overlap:{" "}
            <strong>
              {formatSlotLabel(
                consensus.slot,
                slotsPerDay,
                schedule.dates,
                rowLabels,
              )}
            </strong>{" "}
            ({consensus.count} of {schedule.playerCount})
          </p>
        ) : null}

        <div className="sched-heatmap-wrap">
          <div
            className="sched-heatmap"
            style={
              {
                "--day-cols": schedule.dates.length,
              } as React.CSSProperties
            }
          >
            {/* Header row. */}
            <div className="sched-heatmap-time-col" />
            {dateHeaders.map((h, i) => (
              <div key={"hdr-" + i} className="sched-heatmap-day-col">
                <div className="sched-grid-weekday">{h.weekday}</div>
                <div className="sched-grid-day">{h.day}</div>
              </div>
            ))}

            {/* Body rows. */}
            {rowLabels.map((label, rowIdx) => (
              <Fragment key={rowIdx}>
                <div className="sched-heatmap-time-col">{label}</div>
                {schedule.dates.map((_, dateIdx) => {
                  const idx = slotIndex(dateIdx, rowIdx);
                  const players = playersBySlot.get(idx) ?? [];
                  const count = players.length;
                  const intensity = count / respCount;
                  const mine = myPicks.has(idx);
                  return (
                    <div
                      key={`cell-${rowIdx}-${dateIdx}`}
                      className={
                        "sched-heatmap-cell" +
                        (mine ? " sched-heatmap-cell-mine" : "")
                      }
                      style={{
                        background:
                          count === 0
                            ? "transparent"
                            : `rgba(106, 200, 130, ${0.15 + 0.75 * intensity})`,
                        borderColor: mine ? myColor : undefined,
                      }}
                      onMouseEnter={() => setHoverIdx(idx)}
                      onMouseLeave={() =>
                        setHoverIdx((c) => (c === idx ? null : c))
                      }
                      title={
                        count
                          ? players
                              .map((p) => schedule.responses[p].name)
                              .join(", ")
                          : ""
                      }
                    >
                      {count > 0 ? (
                        <span className="sched-heatmap-count">{count}</span>
                      ) : null}
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>

        {hoverIdx !== null && (playersBySlot.get(hoverIdx)?.length ?? 0) > 0 ? (
          <div className="sched-hover-info">
            <strong>
              {formatSlotLabel(hoverIdx, slotsPerDay, schedule.dates, rowLabels)}
            </strong>
            :{" "}
            {playersBySlot
              .get(hoverIdx)!
              .map((p) => schedule.responses[p].name)
              .join(", ")}
          </div>
        ) : null}
      </div>
    </>
  );
}
