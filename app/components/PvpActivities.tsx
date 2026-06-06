import { envSuffix, resolveAccount } from "@/lib/account";
import {
  findPrimaryMembership,
  getPvpRecord,
  getProfile,
  getRecentPvpMatches,
  pvpModeId,
  pvpModeLabel,
  resolveActivityDefinitions,
  type PvpModeKey,
} from "@/lib/bungie";
import { PvpStrip, type PvpPoint } from "./PvpStrip";

type Props = {
  mode?: PvpModeKey;
  titleOverride?: string;
  accountOverride?: number;
};

export async function PvpActivities({
  mode = "crucible",
  titleOverride,
  accountOverride,
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

  const modeId = pvpModeId(mode);
  const title = titleOverride?.trim() || pvpModeLabel(mode);
  const isGambit = mode === "gambit";

  try {
    const membership = await findPrimaryMembership(account.name, account.code);
    const { characters } = await getProfile(membership);

    const [matches, fetchedRecord] = await Promise.all([
      getRecentPvpMatches(membership, characters, modeId, 10),
      getPvpRecord(membership, modeId),
    ]);

    // Per-stat safety net. The lifetime stats endpoint is unreliable mode-by-
    // mode, so we backfill each headline number individually from the recent
    // match pool whenever the lifetime call returned a zero. The dot strip's
    // data comes from a separate (more reliable) endpoint, so it's our
    // ground truth for win counts and per-match K/D.
    const sampleWins = matches.filter((m) => m.win).length;
    const sampleLosses = matches.length - sampleWins;
    const sampleKills = matches.reduce((s, m) => s + m.kills, 0);
    const sampleDeaths = matches.reduce((s, m) => s + m.deaths, 0);

    const record = {
      wins:
        fetchedRecord.wins > 0 || fetchedRecord.losses > 0
          ? fetchedRecord.wins
          : sampleWins,
      losses:
        fetchedRecord.wins > 0 || fetchedRecord.losses > 0
          ? fetchedRecord.losses
          : sampleLosses,
      kd:
        fetchedRecord.kd > 0
          ? fetchedRecord.kd
          : sampleDeaths > 0
            ? sampleKills / sampleDeaths
            : 0,
    };

    const defs = await resolveActivityDefinitions(
      matches.map((m) => m.referenceHash)
    );

    const points: PvpPoint[] = matches.map((m) => ({
      instanceId: m.instanceId,
      mapName: defs.get(m.referenceHash)?.displayProperties.name,
      durationSeconds: m.durationSeconds,
      durationDisplay: m.durationDisplay,
      period: m.period,
      win: m.win,
      kills: m.kills,
      deaths: m.deaths,
      assists: m.assists,
      kd: m.kd,
    }));

    const winRate =
      record.wins + record.losses > 0
        ? Math.round((record.wins / (record.wins + record.losses)) * 100)
        : 0;

    const stats = [
      { label: "K/D", value: record.kd.toFixed(2) },
      { label: "W RATE", value: `${winRate}%` },
    ];

    return (
      <PvpStrip
        title={title}
        stats={stats}
        matches={points}
        disableLinks={isGambit}
      />
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return <div className="error">Couldn&apos;t load PvP: {msg}</div>;
  }
}
