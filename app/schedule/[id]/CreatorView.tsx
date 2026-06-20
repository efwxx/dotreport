"use client";

import { Fragment, useMemo, useState } from "react";

import { colorForPlayer } from "@/lib/schedule-colors";

interface Props {
  schedule: {
    id: string;
    title: string;
    dates: string[];
    slotMinutes: number;
    playerCount: number;
    questions: { id: string; prompt: string }[];
    responses: {
      id: string;
      name: string;
      submittedAt: string;
      answers: Record<string, string>;
      picks: number[];
    }[];
  };
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

export function CreatorView({ schedule, rowLabels, slotsPerDay }: Props) {
  const [filterIdx, setFilterIdx] = useState<number | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const total = schedule.responses.length;
  const dateHeaders = useMemo(
    () => schedule.dates.map(formatDateHeader),
    [schedule.dates],
  );

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

  function slotIndex(dateIdx: number, rowIdx: number) {
    return dateIdx * slotsPerDay + rowIdx;
  }

  const visibleResponses = useMemo(() => {
    if (filterIdx === null) return schedule.responses;
    return schedule.responses.filter((r) => r.picks.includes(filterIdx));
  }, [filterIdx, schedule.responses]);

  const consensus = useMemo(() => {
    let best: { slot: number; count: number } | null = null;
    for (const [slot, players] of playersBySlot) {
      if (!best || players.length > best.count) {
        best = { slot, count: players.length };
      }
    }
    return best;
  }, [playersBySlot]);

  const respCount = Math.max(1, schedule.responses.length);

  return (
    <div className="sched-creator">
      <div className="sched-card">
        <div className="sched-creator-meta">
          <span className="sched-muted">
            {total} of {schedule.playerCount} player
            {schedule.playerCount === 1 ? "" : "s"} responded
          </span>
          {filterIdx !== null ? (
            <button
              type="button"
              className="sched-btn-ghost"
              onClick={() => setFilterIdx(null)}
            >
              clear filter
            </button>
          ) : null}
        </div>

        <div className="sched-roster">
          {schedule.responses.map((r, i) => (
            <span key={r.id} className="sched-roster-chip">
              <span
                className="sched-swatch"
                style={{ background: colorForPlayer(i) }}
              />
              <span>{r.name}</span>
              <span className="sched-muted">· {r.picks.length}</span>
            </span>
          ))}
          {Array.from({
            length: Math.max(0, schedule.playerCount - total),
          }).map((_, i) => (
            <span
              key={"empty-" + i}
              className="sched-roster-chip sched-roster-empty"
            >
              <span
                className="sched-swatch sched-swatch-empty"
                style={{ color: colorForPlayer(total + i) }}
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

        {total === 0 ? (
          <p className="sched-muted">no responses yet.</p>
        ) : (
          <div className="sched-heatmap-wrap">
            <div
              className="sched-heatmap"
              style={
                {
                  "--day-cols": schedule.dates.length,
                } as React.CSSProperties
              }
            >
              <div className="sched-heatmap-time-col" />
              {dateHeaders.map((h, i) => (
                <div key={"hdr-" + i} className="sched-heatmap-day-col">
                  <div className="sched-grid-weekday">{h.weekday}</div>
                  <div className="sched-grid-day">{h.day}</div>
                </div>
              ))}

              {rowLabels.map((label, rowIdx) => (
                <Fragment key={rowIdx}>
                  <div className="sched-heatmap-time-col">{label}</div>
                  {schedule.dates.map((_, dateIdx) => {
                    const idx = slotIndex(dateIdx, rowIdx);
                    const players = playersBySlot.get(idx) ?? [];
                    const count = players.length;
                    const intensity = count / respCount;
                    const isSelected = filterIdx === idx;
                    return (
                      <div
                        key={`cell-${rowIdx}-${dateIdx}`}
                        className={
                          "sched-heatmap-cell sched-heatmap-cell-click" +
                          (isSelected ? " sched-heatmap-cell-selected" : "")
                        }
                        style={{
                          background:
                            count === 0
                              ? "transparent"
                              : `rgba(106, 200, 130, ${0.15 + 0.75 * intensity})`,
                        }}
                        onMouseEnter={() => setHoverIdx(idx)}
                        onMouseLeave={() =>
                          setHoverIdx((c) => (c === idx ? null : c))
                        }
                        onClick={() =>
                          setFilterIdx((cur) => (cur === idx ? null : idx))
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
        )}

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

      {visibleResponses.length > 0 ? (
        <div className="sched-card">
          <h2 className="sched-h2">responses</h2>
          {filterIdx !== null ? (
            <p className="sched-muted sched-hint">
              filtered to{" "}
              {formatSlotLabel(
                filterIdx,
                slotsPerDay,
                schedule.dates,
                rowLabels,
              )}
              . click the cell again to clear.
            </p>
          ) : null}
          <ul className="sched-response-list">
            {visibleResponses.map((r) => {
              const idx = schedule.responses.indexOf(r);
              return (
                <li key={r.id} className="sched-response">
                  <div className="sched-response-head">
                    <span
                      className="sched-swatch"
                      style={{ background: colorForPlayer(idx) }}
                    />
                    <strong>{r.name}</strong>
                    <span className="sched-muted">· {r.picks.length} slots</span>
                    <span className="sched-muted">
                      · {new Date(r.submittedAt).toLocaleString()}
                    </span>
                  </div>
                  {schedule.questions.length > 0 ? (
                    <dl className="sched-answers">
                      {schedule.questions.map((q) => (
                        <div key={q.id}>
                          <dt>{q.prompt}</dt>
                          <dd>
                            {r.answers[q.id] || (
                              <em className="sched-muted">no answer</em>
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
