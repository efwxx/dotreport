// PvP / Gambit dot strip.
// X axis = time (oldest left, newest right).
// Y axis = per-match K/D (clamped to a sensible range).
// Colour = win (green) vs loss (red).

export type PvpPoint = {
  instanceId: string;
  mapName?: string;
  durationSeconds: number;
  durationDisplay: string;
  period: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  kd: number;
};

type Stat = { label: string; value: string };

type Props = {
  title: string;
  stats: Stat[];
  matches: PvpPoint[];
  // When true, dots render as non-interactive elements instead of links.
  // Used for Gambit, where there isn't a good PGCR viewer to redirect to.
  disableLinks?: boolean;
  pgcrHost?: string;
};

const X_PAD_PCT = 4;
const X_SPAN_PCT = 100 - X_PAD_PCT * 2;
const Y_PAD_PCT = 15;
const Y_SPAN_PCT = 100 - Y_PAD_PCT * 2;

const KD_MIN = 0.5;
const KD_MAX = 2.5;

export function PvpStrip({
  title,
  stats,
  matches,
  disableLinks = false,
  pgcrHost = "raid.report",
}: Props) {
  const points = [...matches].reverse();

  return (
    <div className="card clears-card">
      <div className="card-header">
        <div className="card-title">{title}</div>
        <div className="card-stat-row">
          {stats.map((s) => (
            <div key={s.label} className="card-stat">
              <span className="card-stat-value">{s.value}</span>
              <span className="card-stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {points.length > 0 ? (
        <div className="clears-chart pvp">
          <div className="clears-baseline" />
          {points.map((p, i) => {
            const xPct =
              points.length === 1
                ? 50
                : X_PAD_PCT + (i / (points.length - 1)) * X_SPAN_PCT;
            const yPct = kdY(p.kd || KD_MIN);

            const ago = relativeTime(p.period);
            const dotClass = [
              "clears-dot",
              p.win ? "is-win" : "is-loss",
              disableLinks ? "is-static" : "",
            ]
              .filter(Boolean)
              .join(" ");

            const ariaLabel = `${p.win ? "Win" : "Loss"}, K/D ${p.kd.toFixed(
              2
            )}, ${ago}`;

            const inner = (
              <>
                <span className="clears-dot-core" />
                <span className="flyout" role="tooltip">
                  {p.mapName && (
                    <span className="flyout-name">{p.mapName}</span>
                  )}
                  <span className="flyout-row">
                    <span
                      className={`flyout-pill ${p.win ? "win" : "loss"}`}
                    >
                      {p.win ? "Win" : "Loss"}
                    </span>
                    <span className="flyout-duration">
                      {p.kills}/{p.deaths}/{p.assists}
                    </span>
                  </span>
                  <span className="flyout-row">
                    <span className="flyout-meta">
                      K/D {p.kd.toFixed(2)}
                    </span>
                    <span className="flyout-meta">
                      {p.durationDisplay || formatSeconds(p.durationSeconds)}
                    </span>
                  </span>
                  <span className="flyout-time">{ago}</span>
                </span>
              </>
            );

            // Non-interactive dot for Gambit. Keep tabIndex=0 so keyboard
            // users can still focus to see the flyout, but skip href/target
            // entirely so there's no broken redirect.
            if (disableLinks) {
              return (
                <div
                  key={p.instanceId}
                  className={dotClass}
                  style={{ left: `${xPct}%`, top: `${yPct}%` }}
                  aria-label={ariaLabel}
                  tabIndex={0}
                >
                  {inner}
                </div>
              );
            }

            return (
              <a
                key={p.instanceId}
                className={dotClass}
                style={{ left: `${xPct}%`, top: `${yPct}%` }}
                href={`https://${pgcrHost}/pgcr/${p.instanceId}`}
                target="_blank"
                rel="noreferrer"
                aria-label={ariaLabel}
              >
                {inner}
              </a>
            );
          })}
        </div>
      ) : (
        <div className="empty clears-empty">No recent matches.</div>
      )}
    </div>
  );
}

function kdY(kd: number): number {
  const clamped = Math.min(KD_MAX, Math.max(KD_MIN, kd));
  const norm = 1 - (clamped - KD_MIN) / (KD_MAX - KD_MIN);
  return Y_PAD_PCT + norm * Y_SPAN_PCT;
}

function formatSeconds(s: number): string {
  if (!s) return "";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
}

function relativeTime(iso: string): string {
  const sec = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  );
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
