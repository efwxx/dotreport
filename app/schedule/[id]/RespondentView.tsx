"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { colorForPlayer } from "@/lib/schedule-colors";

interface Props {
  schedule: {
    id: string;
    dates: string[];
    slotMinutes: number;
    playerCount: number;
    questions: { id: string; prompt: string }[];
    responseCount: number;
  };
  rowLabels: string[];
  slotsPerDay: number;
  existing: {
    name: string;
    answers: Record<string, string>;
    picks: number[];
  } | null;
}

function formatDateHeader(iso: string): { weekday: string; day: string } {
  const d = new Date(iso + "T12:00:00");
  return {
    weekday: d.toLocaleDateString(undefined, { weekday: "short" }),
    day: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  };
}

export function RespondentView({
  schedule,
  rowLabels,
  slotsPerDay,
  existing,
}: Props) {
  const router = useRouter();
  const isEditing = existing !== null;

  const seatsLeft = schedule.playerCount - schedule.responseCount;
  const full = seatsLeft <= 0 && !isEditing;
  const hasQuestions = schedule.questions.length > 0;

  type Phase = "questions" | "paint" | "done";
  const [phase, setPhase] = useState<Phase>(
    full ? "done" : hasQuestions && !isEditing ? "questions" : "paint",
  );
  const [name, setName] = useState(existing?.name ?? "");
  const [answers, setAnswers] = useState<Record<string, string>>(
    existing?.answers ?? {},
  );
  const [picks, setPicks] = useState<Set<number>>(
    new Set(existing?.picks ?? []),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Color shown to the player while they pick.
  const previewIdx = isEditing ? -1 : schedule.responseCount;
  const previewColor = useMemo(
    () => (isEditing ? "#8a8a93" : colorForPlayer(previewIdx)),
    [isEditing, previewIdx],
  );

  const dateHeaders = useMemo(
    () => schedule.dates.map(formatDateHeader),
    [schedule.dates],
  );

  function slotIndex(dateIdx: number, rowIdx: number) {
    return dateIdx * slotsPerDay + rowIdx;
  }

  function toggleCell(idx: number) {
    setPicks((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }

  function toggleWholeDay(dateIdx: number) {
    setPicks((prev) => {
      const next = new Set(prev);
      const dayIndices = rowLabels.map((_, rowIdx) => slotIndex(dateIdx, rowIdx));
      const allOn = dayIndices.every((i) => next.has(i));
      if (allOn) {
        dayIndices.forEach((i) => next.delete(i));
      } else {
        dayIndices.forEach((i) => next.add(i));
      }
      return next;
    });
  }

  function submitQuestions(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("name required");
      return;
    }
    for (const q of schedule.questions) {
      if (!(answers[q.id] ?? "").trim()) {
        setError("answer every question to continue");
        return;
      }
    }
    setPhase("paint");
  }

  async function submitAll() {
    setError(null);
    if (!name.trim()) {
      setError("name required");
      if (hasQuestions) setPhase("questions");
      return;
    }
    if (picks.size === 0) {
      setError("pick at least one timeslot");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/schedule/${schedule.id}/respond`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          answers,
          picks: [...picks],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "something went wrong");
        return;
      }
      // Reload the page so it shows the summary view.
      router.refresh();
      router.push(`/schedule/${schedule.id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (full) {
    return (
      <div className="sched-card">
        <h2 className="sched-h2">this schedule is full.</h2>
        <p className="sched-muted">
          {schedule.playerCount} player{schedule.playerCount === 1 ? "" : "s"}{" "}
          have already locked in. ask the organizer to bump the player count
          if you need a seat.
        </p>
      </div>
    );
  }

  if (phase === "questions") {
    return (
      <form className="sched-card sched-form" onSubmit={submitQuestions}>
        <label className="sched-field">
          <span>your bungie name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Yura#0618"
            maxLength={60}
            required
          />
        </label>
        {schedule.questions.map((q) => (
          <label key={q.id} className="sched-field">
            <span>{q.prompt}</span>
            <textarea
              value={answers[q.id] ?? ""}
              onChange={(e) =>
                setAnswers({ ...answers, [q.id]: e.target.value })
              }
              rows={2}
              maxLength={500}
              required
            />
          </label>
        ))}
        {error ? <div className="sched-error">{error}</div> : null}
        <div className="sched-actions">
          <button type="submit" className="sched-btn">
            continue →
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="sched-card">
      {isEditing ? (
        <div className="sched-muted sched-name-chip">
          editing your picks as <strong>{name}</strong>
        </div>
      ) : !hasQuestions ? (
        <label className="sched-field">
          <span>your bungie name</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Yura#0618"
            maxLength={60}
            required
          />
        </label>
      ) : (
        <div className="sched-muted sched-name-chip">
          submitting as <strong>{name}</strong>
        </div>
      )}

      <div className="sched-color-card">
        <span className="sched-swatch" style={{ background: previewColor }} />
        <span className="sched-muted">
          {isEditing ? (
            <>updating your existing picks. cells you paint are timeslots you can commit to.</>
          ) : (
            <>
              you’ll be player{" "}
              <strong>
                {schedule.responseCount + 1} of {schedule.playerCount}
              </strong>{" "}
              ({seatsLeft} seat{seatsLeft === 1 ? "" : "s"} left). every cell
              you paint is a slot you’re committing to.
            </>
          )}
        </span>
      </div>

      <p className="sched-muted sched-hint">
        click each hour you can run. tap a date header to toggle the whole day.{" "}
        {picks.size} of {slotsPerDay * schedule.dates.length} picked.
      </p>

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
            <button
              key={"hdr-" + i}
              type="button"
              className="sched-day-header"
              onClick={() => toggleWholeDay(i)}
              title="toggle entire day"
            >
              <div className="sched-grid-weekday">{h.weekday}</div>
              <div className="sched-grid-day">{h.day}</div>
            </button>
          ))}

          {rowLabels.map((label, rowIdx) => (
            <Fragment key={rowIdx}>
              <div className="sched-heatmap-time-col">{label}</div>
              {schedule.dates.map((_, dateIdx) => {
                const idx = slotIndex(dateIdx, rowIdx);
                const picked = picks.has(idx);
                const fill = isEditing ? "#8a8a93" : previewColor;
                return (
                  <button
                    key={`cell-${rowIdx}-${dateIdx}`}
                    type="button"
                    className={
                      "sched-heatmap-cell sched-heatmap-cell-click sched-heatmap-cell-btn" +
                      (picked ? " sched-heatmap-cell-picked" : "")
                    }
                    style={
                      picked
                        ? { background: fill, borderColor: fill }
                        : undefined
                    }
                    onClick={() => toggleCell(idx)}
                    aria-pressed={picked}
                    aria-label={`${dateHeaders[dateIdx].weekday} ${dateHeaders[dateIdx].day} ${label}`}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

      {error ? <div className="sched-error">{error}</div> : null}

      <div className="sched-actions">
        <button
          type="button"
          className="sched-btn"
          onClick={submitAll}
          disabled={submitting || picks.size === 0}
        >
          {submitting
            ? "submitting…"
            : isEditing
              ? "save changes"
              : "submit"}
        </button>
        {isEditing ? (
          <button
            type="button"
            className="sched-btn-ghost"
            onClick={() => router.push(`/schedule/${schedule.id}`)}
          >
            cancel
          </button>
        ) : null}
      </div>
    </div>
  );
}
