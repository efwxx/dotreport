"use client";

import { useState } from "react";

interface Row {
  id: string;
  title: string;
  createdAt: string;
  dates: string[];
  playerCount: number;
  responseCount: number;
  shareUrl: string;
  creatorUrl: string;
}

export function ScheduleIndex() {
  const [password, setPassword] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/schedule/list", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "could not load");
        return;
      }
      setRows(data.schedules ?? []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (rows === null) {
    return (
      <form className="sched-card sched-form" onSubmit={load}>
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
        {error ? <div className="sched-error">{error}</div> : null}
        <div className="sched-actions">
          <button type="submit" className="sched-btn" disabled={loading}>
            {loading ? "loading…" : "unlock"}
          </button>
        </div>
      </form>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="sched-card">
        <p className="sched-muted">
          no schedules yet. create one to get started.
        </p>
      </div>
    );
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="sched-card">
      <ul className="sched-index-list">
        {rows.map((r) => (
          <li key={r.id} className="sched-index-row">
            <div className="sched-index-head">
              <strong>{r.title}</strong>
              <span className="sched-muted">
                {r.responseCount} / {r.playerCount} responded
              </span>
              <span className="sched-muted">
                · {new Date(r.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div className="sched-link-row">
              <label>share</label>
              <code>{origin + r.shareUrl}</code>
              <button
                type="button"
                className="sched-copy"
                onClick={() =>
                  navigator.clipboard.writeText(origin + r.shareUrl)
                }
              >
                copy
              </button>
            </div>
            <div className="sched-link-row">
              <label>creator</label>
              <code>{origin + r.creatorUrl}</code>
              <button
                type="button"
                className="sched-copy"
                onClick={() =>
                  navigator.clipboard.writeText(origin + r.creatorUrl)
                }
              >
                copy
              </button>
            </div>
            <div className="sched-actions">
              <a className="sched-btn-ghost" href={r.creatorUrl}>
                open creator view
              </a>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
