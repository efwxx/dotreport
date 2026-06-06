import {
  getAuthenticatedUsername,
  getPersonalBests,
} from "@/lib/speedrun";

type Props = {
  username?: string;
  title?: string;
  limit?: number;
};

const ORDINAL_SUFFIX: Record<string, string> = {
  "1": "st",
  "2": "nd",
  "3": "rd",
};

function ordinal(n: number): string {
  if (n <= 0) return "—";
  const k = n % 100;
  if (k >= 11 && k <= 13) return `${n}th`;
  const j = n % 10;
  return `${n}${ORDINAL_SUFFIX[String(j)] ?? "th"}`;
}

function relativeDate(iso?: string): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export async function Speedrun({
  username,
  title = "Personal Bests",
  limit = 5,
}: Props) {
  // Resolution order:
  //   1. Inline `username` prop on the section.
  //   2. SPEEDRUN_USERNAME env var.
  //   3. /profile lookup using SPEEDRUN_API_KEY (if set).
  let user = username?.trim() || process.env.SPEEDRUN_USERNAME?.trim();
  if (!user) {
    user = (await getAuthenticatedUsername()) ?? undefined;
  }
  if (!user) {
    return (
      <div className="empty">
        Set <code>SPEEDRUN_USERNAME</code> or <code>SPEEDRUN_API_KEY</code> in{" "}
        <code>.env.local</code>, or pass <code>username</code> on the section.
      </div>
    );
  }

  const pbs = await getPersonalBests(user, limit);
  const wrs = pbs.filter((p) => p.place === 1).length;

  return (
    <section className="speedrun-section">
      <div className="card speedrun-card">
        <div className="card-header">
          <div className="card-title">{title}</div>
          <div className="card-stat-row">
            {wrs > 0 && (
              <div className="card-stat">
                <span className="card-stat-value">{wrs}</span>
                <span className="card-stat-label">WRs</span>
              </div>
            )}
            <div className="card-stat">
              <a
                className="card-stat-value speedrun-handle"
                href={`https://www.speedrun.com/user/${encodeURIComponent(user)}`}
                target="_blank"
                rel="noreferrer"
              >
                {user}
              </a>
              <span className="card-stat-label">SRC</span>
            </div>
          </div>
        </div>

        {pbs.length > 0 ? (
          <ul className="speedrun-list">
            {pbs.map((pb) => {
              const placeMod = pb.place <= 3 ? `place-${pb.place}` : "place-n";
              const date = relativeDate(pb.date);
              return (
                <li key={pb.runId} className="speedrun-row">
                  <a
                    className="speedrun-link"
                    href={pb.runUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {pb.gameCover ? (
                      <div
                        className="speedrun-cover"
                        style={{ backgroundImage: `url(${pb.gameCover})` }}
                        aria-hidden
                      />
                    ) : (
                      <div className={`speedrun-place ${placeMod}`}>
                        {ordinal(pb.place)}
                      </div>
                    )}
                    <div className="speedrun-info">
                      <div className="speedrun-game" title={pb.gameName}>
                        {pb.gameName}
                      </div>
                      <div className="speedrun-cat" title={pb.categoryName}>
                        {pb.categoryName}
                        {pb.coop ? " · co-op" : ""}
                      </div>
                    </div>
                    <div className="speedrun-end">
                      <div className="speedrun-time">{pb.timeDisplay}</div>
                      <div className="speedrun-meta">
                        <span className={`speedrun-place-pill ${placeMod}`}>
                          {ordinal(pb.place)}
                        </span>
                        {date && <span className="speedrun-date">{date}</span>}
                      </div>
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="empty speedrun-empty">
            No personal bests on file for <code>{user}</code>.
          </div>
        )}
      </div>
    </section>
  );
}
