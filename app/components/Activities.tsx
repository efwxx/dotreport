import { envSuffix, resolveAccount } from "@/lib/account";
import {
  findPrimaryMembership,
  getAggregateActivityClears,
  getLifetimeModeClears,
  getProfile,
  getRecentClears,
  getRecentClearsForActivity,
  MODE_DUNGEON,
  MODE_RAID,
  resolveActivityDefinitions,
} from "@/lib/bungie";
import { ClearsStrip, type ClearPoint } from "./ClearsStrip";

// Defaults come from env so swapping the tracked activity site-wide is a
// one-line change in .env.local. The `*Override` props let any individual
// section in config/site.ts override these inline - useful when you want
// multiple `activity` sections tracking different raids or dungeons.
//
// Wildcard mode: leave `name` empty ("" or "*") to track the 10 most recent
// raid (or dungeon) clears of any kind. Count becomes lifetime mode total
// (including deleted characters).
//
// Filtered mode: any other value is matched as a substring against the
// activity's display name. The actual query mode (raid vs dungeon history)
// is auto-detected from the matched activity's own definition so dropping
// `name: "Spire of the Watcher"` into a section "just works" without the
// caller having to also set `mode: "dungeon"`.

function classifyDifficulty(name: string): "Master" | "Normal" {
  return /master/i.test(name) ? "Master" : "Normal";
}

type Props = {
  nameOverride?: string;
  modeOverride?: "raid" | "dungeon";
  titleOverride?: string;
  // Index into the BUNGIE_NAME(_<n>) env vars. 1 (or undefined) reads the
  // default BUNGIE_NAME / BUNGIE_CODE; 2 reads BUNGIE_NAME_2 / BUNGIE_CODE_2;
  // and so on. Use this to drop activity cards for alt accounts.
  accountOverride?: number;
};

function resolveNameFilter(nameOverride: string | undefined): string | null {
  const raw =
    nameOverride !== undefined
      ? nameOverride.trim()
      : process.env.TRACKED_ACTIVITY_NAME?.trim() ?? "";
  if (raw === "" || raw === "*") return null;
  return raw;
}


export async function Activities({
  nameOverride,
  modeOverride,
  titleOverride,
  accountOverride,
}: Props = {}) {
  const nameFilter = resolveNameFilter(nameOverride);
  const envMode = process.env.TRACKED_ACTIVITY_MODE?.toLowerCase().trim();

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
  const { name, code } = account;

  // Title precedence:
  //   1. Inline `title`
  //   2. Env TRACKED_ACTIVITY_TITLE, ONLY if neither name nor mode was
  //      overridden inline (so a per-section override doesn't accidentally
  //      inherit the global VoG title).
  //   3. Auto-default ("Recent <name>" or "Recent Raids/Dungeons").
  function computeTitle(
    variant: "raid" | "dungeon",
    filter: string | null
  ): string {
    if (titleOverride?.trim()) return titleOverride.trim();
    const envTitle = process.env.TRACKED_ACTIVITY_TITLE?.trim();
    const inlineNoOverrides = nameOverride === undefined && modeOverride === undefined;
    if (envTitle && inlineNoOverrides) return envTitle;
    if (filter) return `Recent ${filter}`;
    return variant === "dungeon" ? "Recent Dungeons" : "Recent Raids";
  }

  try {
    const membership = await findPrimaryMembership(name, code);
    const { characters } = await getProfile(membership);

    // ------ Wildcard: 10 most recent of any activity in this mode ------
    if (!nameFilter) {
      const wildcardMode =
        modeOverride === "dungeon" ||
        (modeOverride === undefined && envMode === "dungeon")
          ? MODE_DUNGEON
          : MODE_RAID;
      const variant: "raid" | "dungeon" =
        wildcardMode === MODE_DUNGEON ? "dungeon" : "raid";

      const [recent, total] = await Promise.all([
        getRecentClears(membership, characters, wildcardMode, 10),
        getLifetimeModeClears(membership, characters, wildcardMode),
      ]);

      const defs = await resolveActivityDefinitions(
        recent.map((a) => a.referenceHash)
      );

      const points: ClearPoint[] = recent.map((a) => {
        const fullName =
          defs.get(a.referenceHash)?.displayProperties.name ??
          (variant === "dungeon" ? "Dungeon" : "Raid");
        return {
          instanceId: a.instanceId,
          name: fullName,
          difficulty: classifyDifficulty(fullName),
          durationSeconds: a.durationSeconds,
          durationDisplay: a.durationDisplay,
          period: a.period,
          playerCount: a.playerCount,
          deaths: a.deaths,
        };
      });

      return (
        <ClearsStrip
          title={computeTitle(variant, null)}
          total={total}
          activities={points}
          variant={variant}
        />
      );
    }

    // ------ Filtered: deep search for a specific activity ------
    const aggregateClears = await getAggregateActivityClears(
      membership,
      characters
    );
    const aggregateDefs = await resolveActivityDefinitions([
      ...aggregateClears.keys(),
    ]);

    const matchingHashes = new Set<number>();
    // Mode votes - clear counts weight which mode the activity belongs to
    // when its definitions disagree (e.g. an activity that lists both raid
    // and "other" modes). Only raid + dungeon are valid votes.
    const modeVotes = new Map<number, number>();
    for (const [hash, def] of aggregateDefs) {
      if (!def.displayProperties.name?.includes(nameFilter)) continue;
      matchingHashes.add(hash);
      const weight = aggregateClears.get(hash) ?? 1;
      const candidates = new Set<number>();
      if (def.directActivityModeType !== undefined) {
        candidates.add(def.directActivityModeType);
      }
      for (const m of def.activityModeTypes ?? []) candidates.add(m);
      for (const m of candidates) {
        if (m === MODE_RAID || m === MODE_DUNGEON) {
          modeVotes.set(m, (modeVotes.get(m) ?? 0) + weight);
        }
      }
    }

    let total = 0;
    for (const hash of matchingHashes) {
      total += aggregateClears.get(hash) ?? 0;
    }

    // Query mode precedence:
    //   1. Inline `mode` override always wins (rare; user knows what they want).
    //   2. Auto-detect from the matched activity's own definition. This is
    //      what makes `{ name: "Spire of the Watcher" }` work without a mode.
    //   3. Env TRACKED_ACTIVITY_MODE.
    //   4. Raid as a final default.
    let queryMode: number;
    if (modeOverride !== undefined) {
      queryMode = modeOverride === "dungeon" ? MODE_DUNGEON : MODE_RAID;
    } else if (modeVotes.size > 0) {
      const sorted = [...modeVotes.entries()].sort((a, b) => b[1] - a[1]);
      queryMode = sorted[0][0];
    } else if (envMode === "dungeon") {
      queryMode = MODE_DUNGEON;
    } else {
      queryMode = MODE_RAID;
    }
    const variant: "raid" | "dungeon" =
      queryMode === MODE_DUNGEON ? "dungeon" : "raid";

    const runs = await getRecentClearsForActivity(
      membership,
      characters,
      queryMode,
      matchingHashes,
      10
    );

    // Fill in any definitions for hashes that surfaced from deep pagination
    // but weren't in the original aggregate-stats pass.
    const runHashes = runs
      .map((r) => r.referenceHash)
      .filter((h) => !aggregateDefs.has(h));
    if (runHashes.length) {
      const extra = await resolveActivityDefinitions(runHashes);
      for (const [h, d] of extra) aggregateDefs.set(h, d);
    }

    const points: ClearPoint[] = runs.map((a) => {
      const fullName =
        aggregateDefs.get(a.referenceHash)?.displayProperties.name ??
        nameFilter;
      return {
        instanceId: a.instanceId,
        name: fullName,
        difficulty: classifyDifficulty(fullName),
        durationSeconds: a.durationSeconds,
        durationDisplay: a.durationDisplay,
        period: a.period,
        playerCount: a.playerCount,
        deaths: a.deaths,
      };
    });

    // Personal best: fastest matching clear in the recent paginated set.
    // Not a true lifetime PB (would need full history walk), but covers the
    // typical "show me my fastest recent run" intent and is honest about
    // it - the BEST stat updates as you set new records.
    const durations = runs
      .map((r) => r.durationSeconds)
      .filter((d) => d > 0);
    const bestDurationSeconds = durations.length
      ? Math.min(...durations)
      : undefined;

    return (
      <ClearsStrip
        title={computeTitle(variant, nameFilter)}
        total={total}
        activities={points}
        variant={variant}
        bestDurationSeconds={bestDurationSeconds}
      />
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return <div className="error">Couldn't load activities: {msg}</div>;
  }
}
