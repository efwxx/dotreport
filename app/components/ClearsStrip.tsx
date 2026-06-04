// A camo.report-style horizontal strip of dots.
// X axis = time (older on the left, newest on the right).
// Y axis = run duration inverted — faster runs sit higher.
//
// Visual markers:
//   ★ (gold star)  — Low-man clear. Shown on RAID dots with ≤4 players,
//                    and on DUNGEON dots only when cleared SOLO. (A 3-man
//                    dungeon clear is just "a normal dungeon", so we don't
//                    star it.)
//   Soft glow      — "Special" achievement. Shown when:
//                      - the run was flawless (0 deaths for this character),
//                      - OR a dungeon was cleared solo.
//
// Each dot is a clickable link to the PGCR. Raid clears link to raid.report,
// dungeon clears to dungeon.report.

export type ClearPoint = {
  instanceId: string;
  name: string;
  difficulty: "Normal" | "Master";
  durationSeconds: number;
  durationDisplay: string;
  period: string;
  playerCount: number;
  deaths: number;
};

type Props = {
  title: string;
  total: number;
  activities: ClearPoint[]; // most-recent-first; we reverse for display.
  variant: "raid" | "dungeon";
};

const X_PAD_PCT = 4;
const X_SPAN_PCT = 100 - X_PAD_PCT * 2;
const Y_PAD_PCT = 15;
const Y_SPAN_PCT = 100 - Y_PAD_PCT * 2;

function pgcrUrl(variant: "raid" | "dungeon", instanceId: string): string {
  const host = variant === "dungeon" ? "dungeon.report" : "raid.report";
  return `https://${host}/pgcr/${instanceId}`;
}

// "Solo" / "Duo" / "Trio" / "Quad" — only for clears at or below quad-man.
// Larger clears (full raid teams of 5–6) get no badge.
function fireteamLabel(count: number): string | null {
  switch (count) {
    case 1:
      return "Solo";
    case 2:
      return "Duo";
    case 3:
      return "Trio";
    case 4:
      return "Quad";
    default:
      return null;
  }
}

function shouldShowStar(variant: "raid" | "dungeon", count: number): boolean {
  if (count <= 0) return false;
  if (variant === "raid") return count <= 4;
  // Dungeon: only solo earns a star.
  return count === 1;
}

function shouldGlow(
  variant: "raid" | "dungeon",
  count: number,
  isFlawless: boolean
): boolean {
  if (isFlawless) return true;
  if (variant === "dungeon" && count === 1) return true;
  return false;
}

export function ClearsStrip({ title, total, activities, variant }: Props) {
  const points = [...activities].reverse();

  const durations = points
    .map((p) => p.durationSeconds)
    .filter((d) => d > 0);
  const minDur = durations.length ? Math.min(...durations) : 0;
  const maxDur = durations.length ? Math.max(...durations) : 0;
  const range = maxDur - minDur || 1;

  return (
    <div className="card clears-card">
      <div className="card-header">
        <div className="card-title">{title}</div>
        <div className="card-stat">
          <span className="card-stat-value">{total.toLocaleString()}</span>
          <span className="card-stat-label">CLEARS</span>
        </div>
      </div>

      {points.length > 0 ? (
        <div className={`clears-chart ${variant}`}>
          <div className="clears-baseline" />
          {points.map((p, i) => {
            const xPct =
              points.length === 1
                ? 50
                : X_PAD_PCT + (i / (points.length - 1)) * X_SPAN_PCT;
            const norm =
              p.durationSeconds > 0
                ? (p.durationSeconds - minDur) / range
                : 0.5;
            const yPct = Y_PAD_PCT + norm * Y_SPAN_PCT;

            const isFlawless = p.deaths === 0;
            const star = shouldShowStar(variant, p.playerCount);
            const glow = shouldGlow(variant, p.playerCount, isFlawless);
            const teamTag = fireteamLabel(p.playerCount);

            const duration =
              p.durationDisplay || formatSeconds(p.durationSeconds);
            const ago = relativeTime(p.period);

            const tagClasses = [
              "flyout-meta",
              star ? "is-star" : "",
              glow ? "is-glow" : "",
            ]
              .filter(Boolean)
              .join(" ");

            const aria = [p.name, p.difficulty, duration, ago];
            if (teamTag) aria.push(teamTag);
            if (isFlawless) aria.push("flawless");

            const dotClass = [
              "clears-dot",
              p.difficulty === "Master" ? "is-master" : "is-normal",
              star ? "is-star" : "",
              glow ? "is-glow" : "",
              isFlawless ? "is-flawless" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <a
                key={p.instanceId}
                className={dotClass}
                style={{ left: `${xPct}%`, top: `${yPct}%` }}
                href={pgcrUrl(variant, p.instanceId)}
                target="_blank"
                rel="noreferrer"
                aria-label={aria.join(", ")}
              >
                <span className="clears-dot-core" />
                {star && (
                  <span className="clears-dot-star" aria-hidden>
                    ★
                  </span>
                )}
                <span className="flyout" role="tooltip">
                  <span className="flyout-name">{p.name}</span>
                  <span className="flyout-row">
                    <span
                      className={`flyout-pill ${p.difficulty.toLowerCase()}`}
                    >
                      {p.difficulty}
                    </span>
                    <span className="flyout-duration">{duration}</span>
                  </span>
                  {(teamTag || isFlawless) && (
                    <span className="flyout-row">
                      {teamTag && (
                        <span className={tagClasses}>
                          {star && (
                            <span className="flyout-star" aria-hidden>
                              ★
                            </span>
                          )}
                          {teamTag}
                        </span>
                      )}
                      {isFlawless && (
                        <span className="flyout-meta is-flawless">
                          Flawless
                        </span>
                      )}
                    </span>
                  )}
                  <span className="flyout-time">{ago}</span>
                </span>
              </a>
            );
          })}
        </div>
      ) : (
        <div className="empty clears-empty">No recent clears.</div>
      )}
    </div>
  );
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
