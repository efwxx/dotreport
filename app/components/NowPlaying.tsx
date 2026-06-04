import { getRecentTrack } from "@/lib/lastfm";

export async function NowPlaying() {
  let body: React.ReactNode;
  let status: React.ReactNode = null;

  try {
    const track = await getRecentTrack();
    if (!track) {
      body = <div className="empty np-empty">No scrobbles yet.</div>;
    } else {
      status = track.nowPlaying ? (
        <div className="card-stat np-status live">
          <span className="card-stat-value">
            <span className="pulse" aria-hidden /> LIVE
          </span>
          <span className="card-stat-label">NOW PLAYING</span>
        </div>
      ) : track.playedAt ? (
        <div className="card-stat np-status">
          <span
            className="card-stat-value"
            title={new Date(track.playedAt * 1000).toLocaleString()}
          >
            {formatAgo(track.playedAt)}
          </span>
          <span className="card-stat-label">LAST PLAYED</span>
        </div>
      ) : null;

      body = (
        <a
          className="np-body"
          href={track.url}
          target="_blank"
          rel="noreferrer"
        >
          <div
            className="np-art"
            style={
              track.image
                ? { backgroundImage: `url(${track.image})` }
                : undefined
            }
            aria-hidden
          />
          <div className="np-text">
            <div className="np-title" title={track.name}>
              {track.name}
            </div>
            <div className="np-sub" title={track.artist}>
              {track.artist}
            </div>
            {track.album && (
              <div className="np-album" title={track.album}>
                {track.album}
              </div>
            )}
          </div>
        </a>
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    body = <div className="error np-empty">Last.fm: {msg}</div>;
  }

  return (
    <div className="card np-card">
      <div className="card-header">
        <div className="card-title">Now Playing</div>
        {status}
      </div>
      {body}
    </div>
  );
}

function formatAgo(uts: number): string {
  const sec = Math.max(0, Math.floor(Date.now() / 1000 - uts));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}
