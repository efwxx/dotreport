import { envSuffix, resolveAccount } from "@/lib/account";
import { findPrimaryMembership, getLiveActivity } from "@/lib/bungie";
import { LiveTimer } from "./LiveTimer";

type Props = {
  accountOverride?: number;
  titleOverride?: string;
};

// Card showing the player's current Destiny activity: name, image, elapsed
// time (ticking client-side), and fireteam. Renders one of four states
// depending on what Bungie's transitory + character data says.

export async function LiveActivity({
  accountOverride,
  titleOverride,
}: Props = {}) {
  const account = resolveAccount(accountOverride);
  if (!account) {
    const idx = accountOverride && accountOverride > 1 ? accountOverride : 1;
    const suffix = envSuffix(idx);
    return (
      <div className="empty">
        Account {idx} not configured. Set <code>BUNGIE_NAME{suffix}</code> and
        <code> BUNGIE_CODE{suffix}</code> in <code>.env.local</code>.
      </div>
    );
  }

  const title = titleOverride?.trim() || "Live Activity";

  let snapshot;
  try {
    const membership = await findPrimaryMembership(account.name, account.code);
    snapshot = await getLiveActivity(membership);
  } catch {
    snapshot = null;
  }

  if (!snapshot) {
    return (
      <div className="card live-card">
        <div className="card-header">
          <div className="card-title">{title}</div>
          <div className="card-stat live-status is-offline">
            <span className="card-stat-value">Error</span>
            <span className="card-stat-label">STATUS</span>
          </div>
        </div>
        <div className="empty live-empty">Couldn&apos;t reach Bungie.</div>
      </div>
    );
  }

  if (snapshot.status === "private") {
    return (
      <StatusCard
        title={title}
        label="Private"
        message={
          <>Transitory data isn&apos;t public for this account.</>
        }
      />
    );
  }

  if (snapshot.status === "offline") {
    return (
      <StatusCard
        title={title}
        label="Offline"
        message="Not playing right now."
      />
    );
  }

  if (snapshot.status === "in-orbit") {
    return (
      <div className="card live-card">
        <div className="card-header">
          <div className="card-title">{title}</div>
          <div className="card-stat live-status is-orbit">
            <span className="card-stat-value">
              <span className="pulse pulse-orbit" aria-hidden /> ORBIT
            </span>
            <span className="card-stat-label">ONLINE</span>
          </div>
        </div>
        <div className="empty live-empty">In orbit or a social space.</div>
        {snapshot.partyMembers.length > 0 && (
          <Fireteam members={snapshot.partyMembers} />
        )}
      </div>
    );
  }

  // status === "in-activity"
  return (
    <div className="card live-card">
      <div className="card-header">
        <div className="card-title">{title}</div>
        <div className="card-stat live-status is-live">
          <span className="card-stat-value">
            <span className="pulse" aria-hidden /> LIVE
          </span>
          <span className="card-stat-label">PLAYING</span>
        </div>
      </div>

      <div className="live-body">
        {snapshot.activityImage && (
          <div
            className="live-activity-image"
            style={{ backgroundImage: `url(${snapshot.activityImage})` }}
            aria-hidden
          />
        )}
        <div className="live-info">
          <div className="live-activity-name" title={snapshot.activityName}>
            {snapshot.activityName ?? "Unknown activity"}
          </div>
          {snapshot.playlistName && (
            <div
              className="live-playlist"
              title={snapshot.playlistName}
            >
              {snapshot.playlistName}
            </div>
          )}
          <div className="live-elapsed" aria-label="Elapsed time">
            {snapshot.startedAt ? (
              <LiveTimer startTime={snapshot.startedAt} />
            ) : (
              "in progress"
            )}
          </div>
        </div>
      </div>

      {snapshot.partyMembers.length > 0 && (
        <Fireteam members={snapshot.partyMembers} />
      )}
    </div>
  );
}

function StatusCard({
  title,
  label,
  message,
}: {
  title: string;
  label: string;
  message: React.ReactNode;
}) {
  return (
    <div className="card live-card">
      <div className="card-header">
        <div className="card-title">{title}</div>
        <div className="card-stat live-status is-offline">
          <span className="card-stat-value">{label}</span>
          <span className="card-stat-label">STATUS</span>
        </div>
      </div>
      <div className="empty live-empty">{message}</div>
    </div>
  );
}

function Fireteam({
  members,
}: {
  members: Array<{
    membershipId: string;
    displayName: string;
    emblemUrl: string | null;
  }>;
}) {
  return (
    <div className="live-fireteam">
      <div className="live-fireteam-label">Fireteam ({members.length})</div>
      <div className="live-fireteam-list">
        {members.map((m) => (
          <div key={m.membershipId} className="live-member">
            {m.emblemUrl && (
              <div
                className="live-member-emblem"
                style={{ backgroundImage: `url(${m.emblemUrl})` }}
                aria-hidden
              />
            )}
            <span className="live-member-name">{m.displayName}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
