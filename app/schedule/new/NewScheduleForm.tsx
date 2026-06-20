"use client";

import { useState } from "react";

interface CreatedLinks {
  shareUrl: string;
  creatorUrl: string;
}

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isoAddDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function datesInRange(fromIso: string, toIso: string): string[] {
  const out: string[] = [];
  let cur = fromIso;
  let safety = 0;
  while (cur <= toIso && safety < 120) {
    out.push(cur);
    cur = isoAddDays(cur, 1);
    safety++;
  }
  return out;
}

export function NewScheduleForm() {
  const [password, setPassword] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [dates, setDates] = useState<string[]>([todayISO()]);
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("23:00");
  const [slotMinutes, setSlotMinutes] = useState<number>(60);
  const [playerCount, setPlayerCount] = useState<number>(6);

  // How many slots per day the current settings produce.
  const slotsPerDay = (() => {
    const parse = (s: string) => {
      const m = /^(\d{1,2}):(\d{2})$/.exec(s);
      if (!m) return null;
      return Number(m[1]) * 60 + Number(m[2]);
    };
    const start = parse(startTime);
    let end = parse(endTime);
    if (start === null || end === null || slotMinutes < 1) return null;
    if (end <= start) end += 24 * 60;
    return Math.max(1, Math.floor((end - start) / slotMinutes));
  })();
  const [rangeFrom, setRangeFrom] = useState(todayISO());
  const [rangeTo, setRangeTo] = useState(isoAddDays(todayISO(), 6));
  const [questions, setQuestions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedLinks | null>(null);

  function addDate() {
    const last = dates[dates.length - 1] ?? todayISO();
    setDates([...dates, isoAddDays(last, 1)]);
  }

  function addRange() {
    if (!rangeFrom || !rangeTo || rangeFrom > rangeTo) return;
    const span = datesInRange(rangeFrom, rangeTo);
    const merged = new Set<string>([...dates, ...span]);
    setDates([...merged].sort());
  }

  function clearDates() {
    setDates([todayISO()]);
  }

  function updateDate(i: number, v: string) {
    const next = [...dates];
    next[i] = v;
    setDates(next);
  }

  function removeDate(i: number) {
    if (dates.length <= 1) return;
    setDates(dates.filter((_, idx) => idx !== i));
  }

  function addQuestion() {
    if (questions.length >= 10) return;
    setQuestions([...questions, ""]);
  }

  function updateQuestion(i: number, v: string) {
    const next = [...questions];
    next[i] = v;
    setQuestions(next);
  }

  function removeQuestion(i: number) {
    setQuestions(questions.filter((_, idx) => idx !== i));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/schedule/new", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          password,
          title,
          note,
          dates,
          startTime,
          endTime,
          slotMinutes: Number(slotMinutes),
          playerCount: Number(playerCount),
          questions: questions.map((q) => q.trim()).filter(Boolean),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "something went wrong");
        return;
      }
      setCreated({ shareUrl: data.shareUrl, creatorUrl: data.creatorUrl });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    return (
      <div className="sched-card">
        <h2 className="sched-h2">schedule created</h2>
        <p className="sched-muted">
          Save the creator link somewhere. It is the only way to view results.
        </p>
        <div className="sched-link-row">
          <label>share</label>
          <code>{origin + created.shareUrl}</code>
          <button
            type="button"
            className="sched-copy"
            onClick={() => navigator.clipboard.writeText(origin + created.shareUrl)}
          >
            copy
          </button>
        </div>
        <div className="sched-link-row">
          <label>creator</label>
          <code>{origin + created.creatorUrl}</code>
          <button
            type="button"
            className="sched-copy"
            onClick={() => navigator.clipboard.writeText(origin + created.creatorUrl)}
          >
            copy
          </button>
        </div>
        <div className="sched-actions">
          <a className="sched-btn" href={created.creatorUrl}>
            open results view
          </a>
          <button
            type="button"
            className="sched-btn-ghost"
            onClick={() => setCreated(null)}
          >
            make another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="sched-card sched-form" onSubmit={submit}>
      <label className="sched-field">
        <span>password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </label>

      <label className="sched-field">
        <span>title</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. friday raid night"
          maxLength={120}
          required
        />
      </label>

      <label className="sched-field">
        <span>note (optional)</span>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="anything you want respondents to know"
          maxLength={280}
        />
      </label>

      <div className="sched-field">
        <span>dates</span>
        <div className="sched-muted sched-hint">
          add days one at a time, or fill a range below.
        </div>
        <div className="sched-date-list">
          {dates.map((d, i) => (
            <div key={i} className="sched-date-row">
              <input
                type="date"
                value={d}
                onChange={(e) => updateDate(i, e.target.value)}
                required
              />
              {dates.length > 1 ? (
                <button
                  type="button"
                  className="sched-x"
                  onClick={() => removeDate(i)}
                  aria-label="remove date"
                >
                  ×
                </button>
              ) : null}
            </div>
          ))}
          <div className="sched-actions">
            <button type="button" className="sched-btn-ghost" onClick={addDate}>
              + add date
            </button>
            {dates.length > 1 ? (
              <button
                type="button"
                className="sched-btn-ghost"
                onClick={clearDates}
              >
                reset to one
              </button>
            ) : null}
          </div>
          <div className="sched-range">
            <span className="sched-range-label">fill range</span>
            <input
              type="date"
              value={rangeFrom}
              onChange={(e) => setRangeFrom(e.target.value)}
              aria-label="range start"
            />
            <span className="sched-muted">→</span>
            <input
              type="date"
              value={rangeTo}
              onChange={(e) => setRangeTo(e.target.value)}
              aria-label="range end"
            />
            <button
              type="button"
              className="sched-btn-ghost"
              onClick={addRange}
            >
              add all
            </button>
          </div>
          <div className="sched-muted sched-hint">
            {dates.length} day{dates.length === 1 ? "" : "s"} selected.
          </div>
        </div>
      </div>

      <div className="sched-row">
        <label className="sched-field">
          <span>start</span>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
        </label>
        <label className="sched-field">
          <span>end</span>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required
          />
        </label>
        <label className="sched-field">
          <span>slot length (minutes)</span>
          <input
            type="number"
            min={5}
            max={240}
            step={5}
            value={slotMinutes}
            onChange={(e) => setSlotMinutes(Number(e.target.value))}
            required
          />
          <div className="sched-slot-presets">
            {[15, 30, 60, 90, 120].map((m) => (
              <button
                type="button"
                key={m}
                className={
                  "sched-chip" +
                  (slotMinutes === m ? " sched-chip-on" : "")
                }
                onClick={() => setSlotMinutes(m)}
              >
                {m}m
              </button>
            ))}
          </div>
        </label>
      </div>

      <div className="sched-muted sched-hint">
        {slotsPerDay !== null ? (
          <>
            preview: <strong>{slotsPerDay}</strong> slot
            {slotsPerDay === 1 ? "" : "s"} per day ({slotMinutes} min each).
          </>
        ) : (
          <>preview unavailable. check your times.</>
        )}
      </div>

      <label className="sched-field">
        <span>player count (2 to 12)</span>
        <input
          type="number"
          min={2}
          max={12}
          step={1}
          value={playerCount}
          onChange={(e) => setPlayerCount(Number(e.target.value))}
          required
        />
        <span className="sched-muted sched-hint">
          schedule closes once this many people respond. each player gets a
          unique color.
        </span>
      </label>

      <div className="sched-field">
        <span>questionnaire (optional)</span>
        <div className="sched-muted sched-hint">
          shown before the grid. respondents must answer to continue.
        </div>
        <div className="sched-q-list">
          {questions.map((q, i) => (
            <div key={i} className="sched-date-row">
              <input
                type="text"
                value={q}
                onChange={(e) => updateQuestion(i, e.target.value)}
                placeholder={`question ${i + 1}`}
                maxLength={200}
              />
              <button
                type="button"
                className="sched-x"
                onClick={() => removeQuestion(i)}
                aria-label="remove question"
              >
                ×
              </button>
            </div>
          ))}
          {questions.length < 10 ? (
            <button
              type="button"
              className="sched-btn-ghost"
              onClick={addQuestion}
            >
              + add question
            </button>
          ) : null}
        </div>
      </div>

      {error ? <div className="sched-error">{error}</div> : null}

      <div className="sched-actions">
        <button type="submit" className="sched-btn" disabled={submitting}>
          {submitting ? "creating…" : "create schedule"}
        </button>
      </div>
    </form>
  );
}
