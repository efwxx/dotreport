// Bungie API client - server-side only.
// Docs: https://bungie-net.github.io/

import { cache } from "react";

const BUNGIE_BASE = "https://www.bungie.net/Platform";
const BUNGIE_CDN = "https://www.bungie.net";

// Activity mode IDs we care about.
// https://bungie-net.github.io/multi/schema_Destiny-HistoricalStats-Definitions-DestinyActivityModeType.html
export const MODE_RAID = 4;
export const MODE_DUNGEON = 82;
// PvP / competitive playlists used by the `pvp` section type. Aggregate
// "AllPvP" gives the union of Crucible playlists; specific modes drill in.
export const MODE_ALL_PVP = 5;
export const MODE_IRON_BANNER = 19;
export const MODE_GAMBIT = 63;
export const MODE_TRIALS = 84;

export type PvpModeKey = "crucible" | "trials" | "ironBanner" | "gambit";

export function pvpModeId(key: PvpModeKey): number {
  switch (key) {
    case "trials":
      return MODE_TRIALS;
    case "ironBanner":
      return MODE_IRON_BANNER;
    case "gambit":
      return MODE_GAMBIT;
    case "crucible":
    default:
      return MODE_ALL_PVP;
  }
}

export function pvpModeLabel(key: PvpModeKey): string {
  switch (key) {
    case "trials":
      return "Trials of Osiris";
    case "ironBanner":
      return "Iron Banner";
    case "gambit":
      return "Gambit";
    case "crucible":
    default:
      return "Crucible";
  }
}

type BungieEnvelope<T> = {
  Response: T;
  ErrorCode: number;
  ErrorStatus: string;
  Message: string;
};

function apiKey(): string {
  const key = process.env.BUNGIE_API_KEY;
  if (!key) throw new Error("BUNGIE_API_KEY is not set");
  return key;
}

type FetchOptions = RequestInit & {
  // Override how long to cache this response. Manifest entries are effectively
  // immutable, so we cache them for 24h; most other calls use 60s.
  cacheSeconds?: number;
  // How many times to retry on a connect-level network failure. Bungie's
  // Cloudflare front occasionally drops new connections when many fire at
  // once - a single retry after a brief backoff handles the common case.
  retries?: number;
};

function isConnectError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const code = (err.cause as { code?: string } | undefined)?.code ?? "";
  return (
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "ENOTFOUND" ||
    code === "EAI_AGAIN" ||
    /fetch failed/i.test(err.message)
  );
}

async function bungieFetch<T>(
  path: string,
  init?: FetchOptions
): Promise<T> {
  const { cacheSeconds = 60, retries = 2, ...rest } = init ?? {};

  const attempt = async (left: number): Promise<Response> => {
    try {
      return await fetch(`${BUNGIE_BASE}${path}`, {
        ...rest,
        headers: {
          "X-API-Key": apiKey(),
          "Content-Type": "application/json",
          ...(rest.headers ?? {}),
        },
        next: { revalidate: cacheSeconds },
      });
    } catch (err) {
      if (left > 0 && isConnectError(err)) {
        // Brief exponential-ish backoff so we don't dog-pile Cloudflare.
        await new Promise((r) => setTimeout(r, 250 * (retries - left + 1)));
        return attempt(left - 1);
      }
      throw err;
    }
  };

  const res = await attempt(retries);
  if (!res.ok) {
    throw new Error(
      `Bungie API ${path} failed: ${res.status} ${res.statusText}`
    );
  }
  const data = (await res.json()) as BungieEnvelope<T>;
  if (data.ErrorCode !== 1) {
    throw new Error(
      `Bungie API ${path} error ${data.ErrorCode}: ${data.Message}`
    );
  }
  return data.Response;
}

export type DestinyMembership = {
  membershipType: number;
  membershipId: string;
  displayName: string;
  bungieGlobalDisplayName?: string;
  bungieGlobalDisplayNameCode?: number;
};

// Find the primary (cross-save) membership for a Bungie name#code.
// Wrapped in React's cache() so Hero / Activities / Links all share the same
// in-flight promise within a single server render instead of firing the POST
// three independent times. (Next's fetch cache doesn't dedupe POSTs.)
export const findPrimaryMembership = cache(
  async (name: string, code: number): Promise<DestinyMembership> => {
    const memberships = await bungieFetch<DestinyMembership[]>(
      `/Destiny2/SearchDestinyPlayerByBungieName/-1/`,
      {
        method: "POST",
        body: JSON.stringify({ displayName: name, displayNameCode: code }),
      }
    );
    if (!memberships.length) {
      throw new Error(
        `No Destiny membership found for ${name}#${String(code).padStart(4, "0")}`
      );
    }
    // Bungie returns memberships in priority order; the first is the primary
    // cross-save destination, which is what we want.
    return memberships[0];
  }
);

export type Character = {
  characterId: string;
  classType: number; // 0=Titan, 1=Hunter, 2=Warlock
  emblemPath: string;
  emblemBackgroundPath: string;
  emblemHash: number;
  dateLastPlayed: string;
  light: number;
  // Stats dict keyed by stat hash. Includes the six character tier stats
  // (Mobility/Resilience/Recovery/Discipline/Intellect/Strength) plus power.
  // Used by the Loadout card's stat readout.
  stats?: Record<string, number>;
};

// Character stat hashes. Bungie repurposed the legacy six (Mobility / Resilience
// / etc.) for the new Edge of Fate stat system - same hash IDs, but the
// display name + icon for each one now resolves to the new stat. Values now
// scale 0-200 instead of 0-100 too.
//
// Order here matters: this is the left-to-right render order on the loadout
// card (Health / Melee / Grenade / Super / Class / Weapons).
export const STAT_HASHES = {
  health: 1943323491,     // was Recovery
  melee: 4244567218,      // was Strength
  grenade: 1735777505,    // was Discipline
  super: 144602215,       // was Intellect
  class: 2996146975,      // was Mobility
  weapons: 392767087,     // was Resilience
} as const;

export const STAT_MAX = 200;

// Display order for the stat row. Drives both the icon row in the card and
// the stat read-out in the full-loadout modal.
export const STAT_ORDER = [
  "health",
  "melee",
  "grenade",
  "super",
  "class",
  "weapons",
] as const;
export type StatKey = (typeof STAT_ORDER)[number];

export type StatDefinition = {
  hash: number;
  displayProperties: {
    name?: string;
    description?: string;
    icon?: string;
  };
};

// Resolve a stat's manifest definition (gives us its icon URL - Bungie's
// CDN-hosted glyph, which DIM also uses for current-system stats since the
// destiny-icons repo only ships legacy stat glyphs). Cached 24h server-side.
export const resolveStatDefinition = cache(
  async (hash: number): Promise<StatDefinition | null> => {
    if (!hash) return null;
    try {
      return await bungieFetch<StatDefinition>(
        `/Destiny2/Manifest/DestinyStatDefinition/${hash}/`,
        { cacheSeconds: 60 * 60 * 24 }
      );
    } catch {
      return null;
    }
  }
);

export type ProfileBundle = {
  characters: Character[];
  mostRecentCharacter: Character;
};

// Get all characters for a profile. Component 200 = Characters.
// Cached per-render so Hero and Activities only fire one request total.
export const getProfile = cache(
  async (membership: DestinyMembership): Promise<ProfileBundle> => {
    const data = await bungieFetch<{
      characters: { data: Record<string, Character> };
    }>(
      `/Destiny2/${membership.membershipType}/Profile/${membership.membershipId}/?components=200`
    );
    const characters = Object.values(data.characters.data);
    if (!characters.length) throw new Error("Profile has no characters");
    const sorted = [...characters].sort(
      (a, b) =>
        new Date(b.dateLastPlayed).getTime() -
        new Date(a.dateLastPlayed).getTime()
    );
    return { characters: sorted, mostRecentCharacter: sorted[0] };
  }
);

export type ActivityHistoryEntry = {
  period: string;
  activityDetails: {
    referenceId: number;
    directorActivityHash: number;
    instanceId: string;
    mode: number;
    modes: number[];
  };
  values: Record<string, { basic: { value: number; displayValue: string } }>;
};

async function getActivityHistory(
  membership: DestinyMembership,
  characterId: string,
  mode: number,
  count = 100,
  page = 0
): Promise<ActivityHistoryEntry[]> {
  try {
    const data = await bungieFetch<{ activities?: ActivityHistoryEntry[] }>(
      `/Destiny2/${membership.membershipType}/Account/${membership.membershipId}/Character/${characterId}/Stats/Activities/?mode=${mode}&count=${count}&page=${page}`,
      // Short TTL so a newly-completed clear shows up within ~30s of the
      // next AutoRefresh tick. Only the first page is hot - deeper pages are
      // historical and could probably use a longer TTL, but the per-page
      // saving isn't worth the extra branching.
      { cacheSeconds: 30 }
    );
    return data.activities ?? [];
  } catch (e) {
    // 1665 = "DestinyPrivacyRestriction" etc. Be lenient, just return empty.
    return [];
  }
}

function entryToResolved(
  entry: ActivityHistoryEntry,
  modeLabel: "raid" | "dungeon"
): ResolvedActivity | null {
  const completed =
    entry.values.completed?.basic.value === 1 &&
    entry.values.completionReason?.basic.value === 0;
  if (!completed) return null;
  return {
    instanceId: entry.activityDetails.instanceId,
    period: entry.period,
    mode: modeLabel,
    completed,
    durationSeconds: entry.values.activityDurationSeconds?.basic.value ?? 0,
    durationDisplay:
      entry.values.activityDurationSeconds?.basic.displayValue ?? "",
    referenceHash: entry.activityDetails.directorActivityHash,
    playerCount: entry.values.playerCount?.basic.value ?? 0,
    deaths: entry.values.deaths?.basic.value ?? 0,
  };
}

export type ResolvedActivity = {
  instanceId: string;
  period: string;
  mode: "raid" | "dungeon";
  completed: boolean;
  durationSeconds: number;
  durationDisplay: string;
  referenceHash: number;
  // Unique player count for the fireteam. Used to flag low-man clears.
  playerCount: number;
  // Character's total deaths during the activity. 0 = flawless run (for this
  // player at least - true team-flawless would require fetching the PGCR).
  deaths: number;
};

// Get the most recent N completed clears for a single mode, merged across all
// characters and deduped by instanceId.
export async function getRecentClears(
  membership: DestinyMembership,
  characters: Character[],
  mode: number,
  limit = 10
): Promise<ResolvedActivity[]> {
  const modeLabel: "raid" | "dungeon" =
    mode === MODE_RAID ? "raid" : "dungeon";
  const results = await Promise.all(
    characters.map((c) =>
      getActivityHistory(membership, c.characterId, mode, 100)
    )
  );

  const seen = new Map<string, ResolvedActivity>();
  for (const entries of results) {
    for (const entry of entries) {
      const r = entryToResolved(entry, modeLabel);
      if (!r) continue;
      if (seen.has(r.instanceId)) continue;
      seen.set(r.instanceId, r);
    }
  }

  return [...seen.values()]
    .sort((a, b) => new Date(b.period).getTime() - new Date(a.period).getTime())
    .slice(0, limit);
}

// Like getRecentClears, but only keeps entries whose activity hash is in
// `matchingHashes`, and paginates each character's history until we have
// enough matches (or run out of history). Useful for tracking a specific
// activity the player may not have run recently - we'll dig back through a
// lot of clears to surface the last 10 of THAT one.
export async function getRecentClearsForActivity(
  membership: DestinyMembership,
  characters: Character[],
  mode: number,
  matchingHashes: Set<number>,
  limit = 10,
  maxPagesPerCharacter = 8
): Promise<ResolvedActivity[]> {
  if (matchingHashes.size === 0) return [];
  const modeLabel: "raid" | "dungeon" =
    mode === MODE_RAID ? "raid" : "dungeon";
  const seen = new Map<string, ResolvedActivity>();

  // Track which characters still have history left. Once a character returns
  // an empty page we stop paging that character (cuts wasted requests for
  // alts that haven't been played in years).
  const exhausted = new Set<string>();

  for (let page = 0; page < maxPagesPerCharacter; page++) {
    const charsToFetch = characters.filter(
      (c) => !exhausted.has(c.characterId)
    );
    if (!charsToFetch.length) break;

    const pageResults = await Promise.all(
      charsToFetch.map((c) =>
        getActivityHistory(membership, c.characterId, mode, 100, page).then(
          (entries) => ({ characterId: c.characterId, entries })
        )
      )
    );

    for (const { characterId, entries } of pageResults) {
      if (entries.length === 0) {
        exhausted.add(characterId);
        continue;
      }
      for (const entry of entries) {
        if (
          !matchingHashes.has(entry.activityDetails.directorActivityHash)
        ) continue;
        const r = entryToResolved(entry, modeLabel);
        if (!r) continue;
        if (seen.has(r.instanceId)) continue;
        seen.set(r.instanceId, r);
      }
    }

    if (seen.size >= limit) break;
  }

  return [...seen.values()]
    .sort((a, b) => new Date(b.period).getTime() - new Date(a.period).getTime())
    .slice(0, limit);
}

// Lifetime mode-level clears (e.g. "all raids" or "all dungeons").
//
// Strategy: walk the AggregateActivityStats per-hash counts (the same data
// that gives us 3,041 VoG clears) and sum every hash whose activity
// definition matches the requested mode. This dodges the /Stats endpoint's
// frequently-empty `characters[]` / `mergedAllCharacters` buckets entirely.
//
// As a supplement, we also attempt to pull deleted-character clears from
// the /Stats endpoint's `mergedDeletedCharacters` bucket, which IS reliably
// populated and is the one slice of data aggregate stats can't see. Failure
// of the supplement is silent - we still return the active-character total.
export async function getLifetimeModeClears(
  membership: DestinyMembership,
  characters: Character[],
  mode: number
): Promise<number> {
  const aggregate = await getAggregateActivityClears(membership, characters);
  if (aggregate.size === 0) return 0;

  const defs = await resolveActivityDefinitions([...aggregate.keys()]);

  let total = 0;
  for (const [hash, count] of aggregate) {
    const def = defs.get(hash);
    if (!def) continue;
    const inMode =
      def.directActivityModeType === mode ||
      def.activityModeTypes?.includes(mode);
    if (inMode) total += count;
  }

  // Best-effort: add deleted-character clears for this mode.
  const modeKey =
    mode === MODE_RAID
      ? "raid"
      : mode === MODE_DUNGEON
        ? "dungeon"
        : null;
  if (modeKey) {
    try {
      const data = await bungieFetch<{
        mergedDeletedCharacters?: {
          results?: Record<
            string,
            {
              allTime?: { activitiesCleared?: { basic: { value: number } } };
            }
          >;
        };
      }>(
        `/Destiny2/${membership.membershipType}/Account/${membership.membershipId}/Stats/?modes=${mode}&groups=General`
      );
      total +=
        data.mergedDeletedCharacters?.results?.[modeKey]?.allTime
          ?.activitiesCleared?.basic.value ?? 0;
    } catch {
      // Silently skip the deleted-character supplement.
    }
  }

  return total;
}

// One PvP / Gambit match summary, as it surfaces from getRecentPvpMatches().
export type PvpMatch = {
  instanceId: string;
  period: string;
  durationSeconds: number;
  durationDisplay: string;
  // standing: 0 = win, 1 = loss for team modes. Higher numbers for FFA.
  standing: number;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  kd: number;
  // Hash of the activity (typically the map) - resolve via
  // resolveActivityDefinitions() if you want the display name.
  referenceHash: number;
  // Gambit-only stats (populated when present in the activity values). Used
  // by the PvP strip to switch the Y-axis to guardian kills instead of K/D
  // for the Gambit variant, since regular K/D is dominated by PvE kills.
  guardianKills?: number;
  motesDeposited?: number;
  invasionKills?: number;
};

// Recent PvP / Gambit matches for the given mode, merged across characters.
// Bungie returns wins as standing === 0 in team modes (Trials, IB, Crucible,
// Gambit). FFA modes use position; we still call standing === 0 a "win"
// (1st place).
export async function getRecentPvpMatches(
  membership: DestinyMembership,
  characters: Character[],
  mode: number,
  limit = 10
): Promise<PvpMatch[]> {
  const results = await Promise.all(
    characters.map((c) => getActivityHistory(membership, c.characterId, mode, 50))
  );

  const seen = new Map<string, PvpMatch>();
  for (const entries of results) {
    for (const entry of entries) {
      const id = entry.activityDetails.instanceId;
      if (seen.has(id)) continue;
      const v = entry.values;
      const standing = v.standing?.basic.value ?? -1;
      // Only count matches that produced a standing - skips matchmaking
      // bailouts and disconnects that Bungie sometimes records with no
      // useful stats.
      if (standing < 0) continue;
      seen.set(id, {
        instanceId: id,
        period: entry.period,
        durationSeconds: v.activityDurationSeconds?.basic.value ?? 0,
        durationDisplay: v.activityDurationSeconds?.basic.displayValue ?? "",
        standing,
        win: standing === 0,
        kills: v.kills?.basic.value ?? 0,
        deaths: v.deaths?.basic.value ?? 0,
        assists: v.assists?.basic.value ?? 0,
        kd: v.killsDeathsRatio?.basic.value ?? 0,
        referenceHash: entry.activityDetails.directorActivityHash,
        guardianKills: v.guardianKills?.basic.value,
        motesDeposited: v.motesDeposited?.basic.value,
        invasionKills: v.invasionKills?.basic.value,
      });
    }
  }

  return [...seen.values()]
    .sort((a, b) => new Date(b.period).getTime() - new Date(a.period).getTime())
    .slice(0, limit);
}

// Mode keys as Bungie returns them in the /Stats response. The same mode can
// appear under multiple names depending on era / endpoint version:
//   mode 63 (Gambit) ships its bucket as "gambit", NOT "allGambit"
//     (the latter would be the aggregate of regular Gambit + Gambit Prime,
//      and only exists when you query a parent mode).
//   mode 5 (AllPvP) ships as "allPvP".
//   mode 19 (IronBanner) ships as "ironBanner".
//   mode 84 (TrialsOfOsiris) ships as "trialsOfOsiris".
//
// We list every observed alias per mode and try them in order, then fall
// back to a case-insensitive scan, then to "whichever single key exists"
// (when you query one mode, the response always has exactly one bucket).
const MODE_RESULT_KEYS: Record<number, string[]> = {
  [MODE_ALL_PVP]: ["allPvP", "pvp"],
  [MODE_IRON_BANNER]: ["ironBanner"],
  [MODE_GAMBIT]: ["gambit", "allGambit"],
  [MODE_TRIALS]: ["trialsOfOsiris"],
};

function getResultsBucket<T extends object>(
  results: Record<string, T> | undefined,
  preferredKeys: string[]
): T | undefined {
  if (!results) return undefined;
  // 1. Exact match on any alias.
  for (const key of preferredKeys) {
    if (results[key]) return results[key];
  }
  // 2. Case-insensitive match on any alias.
  const wanted = new Set(preferredKeys.map((k) => k.toLowerCase()));
  for (const k of Object.keys(results)) {
    if (wanted.has(k.toLowerCase())) return results[k];
  }
  // 3. Single-key fallback. We queried exactly one mode, so the response
  //    should hold exactly one bucket - grab it regardless of its name.
  const keys = Object.keys(results);
  if (keys.length === 1) return results[keys[0]];
  return undefined;
}

export type PvpRecord = {
  wins: number;
  losses: number;
  kd: number;
  // Only populated for Gambit (mode 63). Total guardian-vs-guardian kills
  // across the lifetime of the player on this mode, summed over characters.
  guardianKills?: number;
  motesDeposited?: number;
  invasionKills?: number;
  invasions?: number;
};

// Lifetime W/L for the given PvP mode, summed across characters (Bungie's
// per-mode account stats endpoint). Adds Gambit-specific extras when mode
// is Gambit.
export async function getPvpRecord(
  membership: DestinyMembership,
  mode: number
): Promise<PvpRecord> {
  const modeKeys = MODE_RESULT_KEYS[mode];
  if (!modeKeys) return { wins: 0, losses: 0, kd: 0 };

  // Accumulator: we walk every possible bucket location Bungie might have
  // hidden the data in, summing as we go. Returns true once any path has
  // produced non-zero activitiesEntered - that's our short-circuit signal.
  let wins = 0;
  let entered = 0;
  let cleared = 0;
  let totalKills = 0;
  let totalDeaths = 0;
  let guardianKills = 0;
  let motesDeposited = 0;
  let invasionKills = 0;
  let invasions = 0;

  type SV = { basic: { value: number } };
  type PeriodBucket = {
    activitiesWon?: SV;
    activitiesEntered?: SV;
    // Matches actually played to completion. Use this as the win-rate
    // denominator when present - `activitiesEntered` over-counts because
    // it includes matchmaking quits and joined-in-progress entries.
    activitiesCleared?: SV;
    kills?: SV;
    deaths?: SV;
    guardianKills?: SV;
    motesDeposited?: SV;
    invasionKills?: SV;
    invasions?: SV;
  };
  type Bucket = { allTime?: PeriodBucket };
  type Resp = {
    mergedAllCharacters?: {
      results?: Record<string, Bucket>;
      merged?: Bucket;
    };
    characters?: Array<{
      results?: Record<string, Bucket>;
      merged?: Bucket;
    }>;
  };

  const ingest = (b: PeriodBucket | undefined): boolean => {
    if (!b) return false;
    const e = b.activitiesEntered?.basic.value ?? 0;
    if (e === 0) return false;
    entered += e;
    cleared += b.activitiesCleared?.basic.value ?? 0;
    wins += b.activitiesWon?.basic.value ?? 0;
    totalKills += b.kills?.basic.value ?? 0;
    totalDeaths += b.deaths?.basic.value ?? 0;
    guardianKills += b.guardianKills?.basic.value ?? 0;
    motesDeposited += b.motesDeposited?.basic.value ?? 0;
    invasionKills += b.invasionKills?.basic.value ?? 0;
    invasions += b.invasions?.basic.value ?? 0;
    return true;
  };

  // Try a few query shapes - Bungie's behavior for the modes/groups
  // parameters is inconsistent across modes. Order matters: try the most
  // common shape first, fall back to broader queries.
  const queryPaths = [
    `/Destiny2/${membership.membershipType}/Account/${membership.membershipId}/Stats/?modes=${mode}`,
    `/Destiny2/${membership.membershipType}/Account/${membership.membershipId}/Stats/?modes=${mode}&groups=General`,
    `/Destiny2/${membership.membershipType}/Account/${membership.membershipId}/Stats/?groups=General`,
  ];

  for (const path of queryPaths) {
    try {
      const data = await bungieFetch<Resp>(path);

      // 1. mergedAllCharacters.results[<mode key>]
      const fromMergedNamed = getResultsBucket(
        data.mergedAllCharacters?.results,
        modeKeys
      );
      if (ingest(fromMergedNamed?.allTime)) break;

      // 2. mergedAllCharacters.merged - cross-mode aggregate. When we query
      //    a single mode this equals results[mode]; populated even when the
      //    named bucket is missing on some accounts.
      if (ingest(data.mergedAllCharacters?.merged?.allTime)) break;

      // 3. Sum each character's results[<mode key>].
      let hit = false;
      for (const c of data.characters ?? []) {
        const b = getResultsBucket(c.results, modeKeys);
        if (ingest(b?.allTime)) hit = true;
      }
      if (hit) break;

      // 4. Sum each character's `merged` bucket.
      for (const c of data.characters ?? []) {
        if (ingest(c.merged?.allTime)) hit = true;
      }
      if (hit) break;
    } catch {
      // try the next query shape
    }
  }

  const kd = totalDeaths > 0 ? totalKills / totalDeaths : 0;
  // Prefer `activitiesCleared` for losses since `activitiesEntered` is
  // polluted by matchmaking quits / DC joins / didn't-stay-to-end entries
  // which Bungie still counts toward "entered" but never let the player
  // win or properly lose. For accounts where activitiesCleared isn't
  // populated, fall back to activitiesEntered.
  const completed = cleared > 0 ? cleared : entered;
  const losses = Math.max(0, completed - wins);
  const record: PvpRecord = { wins, losses, kd };
  if (mode === MODE_GAMBIT) {
    record.guardianKills = guardianKills;
    record.motesDeposited = motesDeposited;
    record.invasionKills = invasionKills;
    record.invasions = invasions;
  }
  return record;
}

// PGCR (Post Game Carnage Report). Includes the full per-player stat dump
// for a single match - including stats like `guardianKills` that get stripped
// out of the activity-history endpoint's reduced values dict.
//
// Lives on a different host than the rest of the Bungie API (stats.bungie.net,
// not www.bungie.net) and isn't versioned under /Destiny2/Manifest/, so we
// bypass the bungieFetch wrapper and hit it directly.
export type PgcrPlayerEntry = {
  characterId?: string;
  player?: {
    destinyUserInfo?: {
      membershipId?: string;
      membershipType?: number;
      bungieGlobalDisplayName?: string;
      bungieGlobalDisplayNameCode?: number;
      displayName?: string;
    };
  };
  values?: Record<string, { basic: { value: number; displayValue: string } }>;
  extended?: {
    values?: Record<
      string,
      { basic: { value: number; displayValue: string } }
    >;
  };
};

export type PgcrReport = {
  period: string;
  activityDetails: {
    instanceId: string;
    directorActivityHash: number;
    mode: number;
  };
  entries?: PgcrPlayerEntry[];
};

// Long TTL - PGCRs are frozen the moment a match ends. The point of even
// using `revalidate` here at all is so Next will refresh if the server is
// running for >7 days; the data itself never moves.
export const getPostGameReport = cache(
  async (instanceId: string): Promise<PgcrReport | null> => {
    try {
      const res = await fetch(
        `https://stats.bungie.net/Platform/Destiny2/Stats/PostGameCarnageReport/${instanceId}/`,
        {
          headers: {
            "X-API-Key": apiKey(),
            Accept: "application/json",
          },
          next: { revalidate: 60 * 60 * 24 * 7 },
        }
      );
      if (!res.ok) return null;
      const data = (await res.json()) as {
        Response?: PgcrReport;
        ErrorCode: number;
      };
      if (data.ErrorCode !== 1 || !data.Response) return null;
      return data.Response;
    } catch {
      return null;
    }
  }
);

// Sums a single stat key across the player's entries in a batch of PGCRs.
// Used by the Gambit card to compute guardian kills, which activity history
// drops but PGCR exposes.
export async function sumPgcrStat(
  instanceIds: string[],
  membershipId: string,
  statKey: string,
  // Concurrency cap. Bungie tolerates a fair amount of parallelism but
  // batching keeps us well clear of rate limits even on cold cache.
  concurrency = 8
): Promise<number> {
  let total = 0;
  for (let i = 0; i < instanceIds.length; i += concurrency) {
    const slice = instanceIds.slice(i, i + concurrency);
    const pgcrs = await Promise.all(slice.map((id) => getPostGameReport(id)));
    for (const pgcr of pgcrs) {
      if (!pgcr?.entries) continue;
      for (const entry of pgcr.entries) {
        if (entry.player?.destinyUserInfo?.membershipId !== membershipId) {
          continue;
        }
        total += entry.values?.[statKey]?.basic.value ?? 0;
      }
    }
  }
  return total;
}

export type ActivityDefinition = {
  hash: number;
  displayProperties: { name: string; description: string; icon?: string };
  pgcrImage?: string;
  // Mode classification - used to filter aggregate-stats hashes down to
  // "everything that counts as a raid" or "everything that counts as a
  // dungeon" when summing lifetime totals.
  directActivityModeType?: number;
  activityModeTypes?: number[];
};

// A subset of DestinyInventoryItemDefinition we need for emblems.
// `secondarySpecial` is the wide cinematic background (no icon baked in),
// which is what we use as the hero backdrop.
export type EmblemDefinition = {
  hash: number;
  displayProperties: { name: string; icon?: string };
  secondaryIcon?: string;
  secondaryOverlay?: string;
  secondarySpecial?: string;
  backgroundColor?: { red: number; green: number; blue: number; alpha: number };
};

// Look up a player's display name + tag by their Destiny membership id.
// Used to fill in missing names on fireteam members - Bungie's transitory
// `partyMembers[].displayName` ships blank for many accounts, especially
// on the freshly-created Bungie Name system. Hitting the User endpoint
// once per missing member gets us the proper "Name#0000" tag. Cached for
// 24h since this changes very rarely.
export const resolvePlayerInfo = cache(
  async (membershipId: string): Promise<string | null> => {
    try {
      type Resp = {
        bungieNetUser?: { displayName?: string };
        destinyMemberships?: Array<{
          bungieGlobalDisplayName?: string;
          bungieGlobalDisplayNameCode?: number;
          displayName?: string;
        }>;
      };
      const data = await bungieFetch<Resp>(
        // membershipType -1 = "All Memberships" - Bungie figures out the
        // correct platform for us.
        `/User/GetMembershipDataById/${membershipId}/-1/`,
        { cacheSeconds: 60 * 60 * 24 }
      );
      // Prefer Bungie Global Display Name (the cross-platform tag).
      const mem = data.destinyMemberships?.find(
        (m) => m.bungieGlobalDisplayName && m.bungieGlobalDisplayNameCode
      );
      if (mem?.bungieGlobalDisplayName) {
        const code = String(mem.bungieGlobalDisplayNameCode ?? 0).padStart(
          4,
          "0"
        );
        return `${mem.bungieGlobalDisplayName}#${code}`;
      }
      // Fall back to legacy platform display name or BungieNet handle.
      const legacy = data.destinyMemberships?.[0]?.displayName?.trim();
      if (legacy) return legacy;
      const bnet = data.bungieNetUser?.displayName?.trim();
      if (bnet) return bnet;
      return null;
    } catch {
      return null;
    }
  }
);

// Live-activity snapshot for the LiveActivity card.
//
// Status determination uses ProfileTransitoryData as the truth source for
// "is the player online", because the per-character CharacterActivities data
// stays stale for hours after a session ends (Bungie just leaves the last
// activity hash sitting there). Transitory's `partyMembers` array is
// populated only while the player is actively logged in, and its
// `currentActivity.endTime` flips to a past timestamp the moment an activity
// ends. Combine those two and we get a reliable online / offline signal.
export type LiveActivityStatus =
  | "in-activity" // in a real activity (raid, strike, crucible, etc.)
  | "in-orbit" // online but not in any activity (orbit, social space, menus)
  | "offline" // not logged in - transitory data is empty
  | "private"; // Bungie privacy is hiding the data

export type LiveActivitySnapshot = {
  status: LiveActivityStatus;
  // ISO timestamp the current activity began. Used by the client-side timer.
  startedAt?: string;
  // `activityName` is the specific map/encounter (e.g. "The Burnout" in
  // Trials, "Vault of Glass" in a raid). `playlistName` is the parent
  // playlist/mode the player queued from (e.g. "Trials of Osiris", "Iron
  // Banner Control"). Only set when it's distinct from `activityName` -
  // raid/dungeon/story sessions leave it undefined.
  activityName?: string;
  playlistName?: string;
  activityImage?: string | null;
  modeType?: number;
  // The fireteam, INCLUDING the player themselves. Empty array offline /
  // private.
  partyMembers: Array<{
    membershipId: string;
    displayName: string;
    emblemUrl: string | null;
  }>;
};

type TransitoryData = {
  partyMembers?: Array<{
    membershipId: string;
    emblemHash: number;
    displayName: string;
    status: number;
  }>;
  currentActivity?: {
    startTime?: string;
    endTime?: string;
  };
};

type CharacterActivity = {
  dateActivityStarted?: string;
  currentActivityHash: number;
  currentActivityModeType?: number;
  // For playlist-based activities (Trials, Crucible, Iron Banner, Gambit,
  // Vanguard Ops, etc.) Bungie populates this with the playlist's hash. The
  // map/instance lives in `currentActivityHash`. For non-playlist content
  // (raids, dungeons, story) this is usually 0 or matches currentActivityHash.
  currentPlaylistActivityHash?: number;
};

// Component privacy: 1 = public, 2 = private. Defined here to avoid magic
// numbers further down.
const PRIVACY_PRIVATE = 2;

function isActivityOngoing(
  currentActivity: TransitoryData["currentActivity"]
): boolean {
  if (!currentActivity?.startTime) return false;
  // Bungie uses a sentinel future date (year 9999) while the activity is
  // in progress and flips endTime to the actual end timestamp once it's
  // over. Anything in the past means the activity has ended.
  if (currentActivity.endTime) {
    const endMs = new Date(currentActivity.endTime).getTime();
    if (Number.isFinite(endMs) && endMs > 0 && endMs < Date.now()) {
      return false;
    }
  }
  return true;
}

export async function getLiveActivity(
  membership: DestinyMembership
): Promise<LiveActivitySnapshot | null> {
  type ComponentEnvelope<T> = { data?: T; privacy?: number };
  type Resp = {
    profileTransitoryData?: ComponentEnvelope<TransitoryData>;
    characterActivities?: ComponentEnvelope<Record<string, CharacterActivity>>;
  };

  let data: Resp;
  try {
    data = await bungieFetch<Resp>(
      `/Destiny2/${membership.membershipType}/Profile/${membership.membershipId}/?components=204,1000`,
      // Tight TTL - this card lives or dies on freshness.
      { cacheSeconds: 15 }
    );
  } catch {
    return null;
  }

  const transWrap = data.profileTransitoryData;
  const transitory = transWrap?.data;
  const chars = data.characterActivities?.data ?? {};

  // Resolve party-member emblems up front so every branch can return them.
  // Offline / orbit states still render an empty fireteam list cleanly.
  //
  // Defensive fallbacks: Bungie's transitory data sometimes returns blank
  // displayNames (notably for the player themselves on the local roster) and
  // zero emblem hashes for the "tower" emblem state. We fall back to the
  // signed-in account's tag for self, and to a sensible placeholder for
  // anyone else. Emblem URL gracefully degrades to null and the UI skips
  // the thumbnail entirely.
  const members = transitory?.partyMembers ?? [];
  const emblemDefs = await Promise.all(
    members.map((m) =>
      m.emblemHash
        ? resolveEmblemDefinition(m.emblemHash).catch(() => null)
        : Promise.resolve(null)
    )
  );
  const selfTag =
    membership.bungieGlobalDisplayName?.trim() ||
    membership.displayName?.trim() ||
    null;

  // For each member with a missing display name, hit the User endpoint to
  // resolve their tag. Done in parallel; resolvePlayerInfo is cached so
  // repeated views are free. Self never needs this lookup - we already have
  // the tag from the membership we used to bootstrap.
  const memberLookups = await Promise.all(
    members.map(async (m) => {
      const raw = m.displayName?.trim();
      if (raw) return raw;
      if (m.membershipId === membership.membershipId) return selfTag;
      const looked = await resolvePlayerInfo(m.membershipId);
      return looked || null;
    })
  );

  const partyMembers = members.map((m, i) => {
    const def = emblemDefs[i];
    const displayName = memberLookups[i] || "Guardian";
    return {
      membershipId: m.membershipId,
      displayName,
      emblemUrl:
        cdn(def?.secondaryIcon) ?? cdn(def?.displayProperties.icon) ?? null,
    };
  });

  // Privacy hides the whole bucket.
  if (transWrap?.privacy === PRIVACY_PRIVATE) {
    return { status: "private", partyMembers: [] };
  }

  // Transitory data is the offline-detection truth: while a player is logged
  // in, Bungie always populates `partyMembers` with at least the player
  // themselves. An empty / missing array means they're not currently online,
  // regardless of what the stale character-activities data says.
  const isOnline = members.length > 0;
  if (!isOnline) {
    return { status: "offline", partyMembers: [] };
  }

  // Player is online but currentActivity has ended or isn't populated yet.
  // This catches the moment between activities (back in orbit) and the
  // social spaces where transitory's currentActivity stays cleared.
  if (!isActivityOngoing(transitory?.currentActivity)) {
    return { status: "in-orbit", partyMembers };
  }

  // Online + in an ongoing activity - pick the activity hash from whichever
  // character is ACTUALLY on it. Bungie leaves stale `currentActivityHash`
  // values on idle alts for hours after you log off them, so we have to be
  // strict about matching:
  //
  //   1. The character's `dateActivityStarted` must equal the transitory
  //      `currentActivity.startTime` exactly (both are server-set, so they
  //      match to the second when the data is genuinely live).
  //   2. That character's `currentActivityHash` must be non-zero.
  //
  // No fallback. If neither condition holds, we default to orbit rather
  // than risk surfacing a stale activity from an idle alt. That's the
  // failure mode the user keeps hitting after a character swap.
  const liveStart = transitory?.currentActivity?.startTime;
  const activeChar = liveStart
    ? Object.values(chars).find(
        (c) =>
          c.dateActivityStarted === liveStart &&
          c.currentActivityHash &&
          c.currentActivityHash !== 0
      )
    : undefined;

  if (!activeChar) {
    // No confident match - could be a brand-new instance whose hash hasn't
    // propagated, a character swap that left the alt holding the live hash,
    // or just orbit. All three render the same way: as orbit.
    return {
      status: "in-orbit",
      partyMembers,
      startedAt: liveStart,
    };
  }

  // Resolve both the specific activity AND the playlist it was queued from,
  // when they differ. This is how we get "Trials of Osiris" + "The Burnout"
  // for PvP playlists rather than just one or the other.
  const hashesToResolve = [activeChar.currentActivityHash];
  const playlistHash = activeChar.currentPlaylistActivityHash;
  if (playlistHash && playlistHash !== activeChar.currentActivityHash) {
    hashesToResolve.push(playlistHash);
  }
  const defs = await resolveActivityDefinitions(hashesToResolve);
  const def = defs.get(activeChar.currentActivityHash);
  const playlistDef = playlistHash ? defs.get(playlistHash) : undefined;

  const activityName = def?.displayProperties.name;
  const playlistName = playlistDef?.displayProperties.name;
  // Only surface the playlist as a separate line if it actually adds info.
  // (Same name means we'd just be repeating ourselves; a raid's playlist
  // hash typically resolves to the same display name as the activity.)
  const showPlaylist =
    playlistName && playlistName !== activityName ? playlistName : undefined;

  return {
    status: "in-activity",
    startedAt:
      transitory?.currentActivity?.startTime ?? activeChar.dateActivityStarted,
    activityName,
    playlistName: showPlaylist,
    activityImage:
      cdn(def?.pgcrImage) ?? cdn(def?.displayProperties.icon) ?? null,
    modeType: activeChar.currentActivityModeType,
    partyMembers,
  };
}

// Well-known inventory bucket hashes - all stable since launch, used by the
// loadout card to slot equipped items into kinetic/energy/power weapon and
// armor pieces without having to walk DestinyInventoryBucketDefinition.
export const BUCKET_KINETIC = 1498876634;
export const BUCKET_ENERGY = 2465295065;
export const BUCKET_POWER = 953998645;
export const BUCKET_HELMET = 3448274439;
export const BUCKET_GAUNTLETS = 3551918588;
export const BUCKET_CHEST = 14239492;
export const BUCKET_LEG = 20886954;
export const BUCKET_CLASS_ARMOR = 1585787867;
export const BUCKET_SUBCLASS = 3284755031;

// Tier types from DestinyItemTierType. Exotic gets the gold border treatment;
// everything else gets a more muted ring.
export const TIER_EXOTIC = 6;
export const TIER_LEGENDARY = 5;

// Generalised inventory item definition - covers weapons, armor, emblems,
// ghost shells, etc. We deliberately allow extra fields here so the same
// lookup powers both the loadout card and the existing emblem code.
export type InventoryItemDefinition = {
  hash: number;
  displayProperties: {
    name?: string;
    description?: string;
    icon?: string;
    hasIcon?: boolean;
  };
  itemTypeDisplayName?: string;
  itemTypeAndTierDisplayName?: string;
  inventory?: {
    tierType?: number;
    tierTypeName?: string;
    bucketTypeHash?: number;
  };
  iconWatermark?: string;
  flavorText?: string;
  // Perk / plug fields, populated for socket plugs only.
  plug?: {
    plugCategoryHash?: number;
    plugCategoryIdentifier?: string;
  };
  traitIds?: string[];
  // Emblem-specific fields, populated for emblem items only.
  secondaryIcon?: string;
  secondaryOverlay?: string;
  secondarySpecial?: string;
  backgroundColor?: { red: number; green: number; blue: number; alpha: number };
};

// Covers the classic Enhanced trait (Witch Queen onward) and the Tier 4 /
// Tier 5 weapon-perk system. Bungie doesn't expose a single flag, so we
// match across trait IDs, item type label, and plug-category identifier.
function isEnhancedPlug(def: InventoryItemDefinition | null): boolean {
  if (!def) return false;
  const haystacks: string[] = [
    ...(def.traitIds ?? []),
    def.itemTypeDisplayName ?? "",
    def.plug?.plugCategoryIdentifier ?? "",
  ].map((s) => s.toLowerCase());
  const tokens = ["enhanced", "tier_4", "tier_5", "tier4", "tier5"];
  return haystacks.some((h) => tokens.some((t) => h.includes(t)));
}

// Shared cached lookup. Used by Hero (for emblem art), Loadout (for weapons
// + armor), and anywhere else that needs an item definition.
export const resolveInventoryItem = cache(
  async (hash: number): Promise<InventoryItemDefinition | null> => {
    if (!hash) return null;
    try {
      return await bungieFetch<InventoryItemDefinition>(
        `/Destiny2/Manifest/DestinyInventoryItemDefinition/${hash}/`,
        { cacheSeconds: 60 * 60 * 24 }
      );
    } catch {
      return null;
    }
  }
);

// ---------- Clan ----------

export type ClanBannerData = {
  decalId: number;
  decalColorId: number;
  decalBackgroundColorId: number;
  gonfalonId: number;
  gonfalonColorId: number;
  gonfalonDetailId: number;
  gonfalonDetailColorId: number;
};

export type ClanInfo = {
  groupId: string;
  name: string;
  motto?: string;
  memberCount: number;
  // 1=Beginner, 2=Member, 3=Admin, 4=Acting Founder, 5=Founder
  memberType: number;
  memberTypeLabel: string;
  joinDate?: string;
  avatarPath?: string;
  // Customization data for the rendered clan banner. When present, the
  // Clan card composites a real banner from manifest assets instead of
  // showing the small avatar.
  bannerData?: ClanBannerData;
  // Web link to the clan's bungie.net page.
  url: string;
};

function memberTypeName(type: number): string {
  switch (type) {
    case 5: return "Founder";
    case 4: return "Acting Founder";
    case 3: return "Admin";
    case 2: return "Member";
    case 1: return "Beginner";
    default: return "Member";
  }
}

export async function getClanInfo(
  membership: DestinyMembership
): Promise<ClanInfo | null> {
  type GroupsForMemberResp = {
    results?: Array<{
      member?: { memberType?: number; memberSince?: string };
      group?: {
        groupId?: string;
        name?: string;
        motto?: string;
        memberCount?: number;
        avatarPath?: string;
      };
    }>;
  };
  type ClanDetailResp = {
    detail?: {
      groupId?: string;
      name?: string;
      motto?: string;
      memberCount?: number;
      avatarPath?: string;
      clanInfo?: {
        clanBannerData?: ClanBannerData;
      };
    };
  };

  try {
    // Step 1: find the user's first clan.
    // Filter 0 = All groups, type 1 = Clan.
    const groups = await bungieFetch<GroupsForMemberResp>(
      `/GroupV2/User/${membership.membershipType}/${membership.membershipId}/0/1/`,
      { cacheSeconds: 60 * 60 * 6 }
    );
    const first = groups.results?.[0];
    if (!first?.group?.groupId || !first.group.name) return null;
    const memberType = first.member?.memberType ?? 2;

    // Step 2: fetch the full clan detail. The GroupsForMember response often
    // omits the nested clanInfo.clanBannerData - without this second call,
    // we can never composite the banner and always fall back to the avatar.
    let bannerData: ClanBannerData | undefined;
    let detailMotto: string | undefined;
    let detailMemberCount: number | undefined;
    let detailAvatar: string | undefined;
    try {
      const detail = await bungieFetch<ClanDetailResp>(
        `/GroupV2/${first.group.groupId}/`,
        { cacheSeconds: 60 * 60 * 6 }
      );
      bannerData = detail.detail?.clanInfo?.clanBannerData;
      detailMotto = detail.detail?.motto || undefined;
      detailMemberCount = detail.detail?.memberCount;
      detailAvatar = detail.detail?.avatarPath || undefined;
    } catch {
      // Step 2 is best-effort - if it fails we still have the basics.
    }

    return {
      groupId: first.group.groupId,
      name: first.group.name,
      motto: detailMotto || first.group.motto || undefined,
      memberCount: detailMemberCount ?? first.group.memberCount ?? 0,
      memberType,
      memberTypeLabel: memberTypeName(memberType),
      joinDate: first.member?.memberSince,
      avatarPath: detailAvatar || first.group.avatarPath || undefined,
      bannerData,
      url: `https://www.bungie.net/en/ClanV2?groupid=${first.group.groupId}`,
    };
  } catch {
    return null;
  }
}

// ---------- Clan banner composition ----------
//
// Clan banners are rendered from `DestinyClanBannerSource` (a single manifest
// entry, hash 1). It exposes the gonfalon shape, the decal, accent details,
// and the colour palettes - each layer is a B&W image you tint with the
// chosen colour. The Clan card stacks 5 mask-coloured div layers to recreate
// the banner Bungie shows in-game.

type ClanBannerAsset = {
  id: number;
  foregroundPath?: string;
  backgroundPath?: string;
};
type ClanBannerColor = {
  id: number;
  colorR: number;
  colorG: number;
  colorB: number;
  colorA?: number;
};
export type ClanBannerSource = {
  decals: ClanBannerAsset[];
  decalPrimaryColors: ClanBannerColor[];
  decalSecondaryColors: ClanBannerColor[];
  gonfalons: ClanBannerAsset[];
  gonfalonColors: ClanBannerColor[];
  gonfalonDetails: ClanBannerAsset[];
  gonfalonDetailColors: ClanBannerColor[];
};

const getClanBannerSource = cache(
  async (): Promise<ClanBannerSource | null> => {
    try {
      return await bungieFetch<ClanBannerSource>(
        `/Destiny2/Manifest/DestinyClanBannerSource/1/`,
        { cacheSeconds: 60 * 60 * 24 * 7 }
      );
    } catch {
      return null;
    }
  }
);

export type ResolvedBannerLayer = {
  imageUrl: string;
  color: string; // CSS rgb() string
};

export type ResolvedClanBanner = {
  // Stacked back-to-front. Each layer is the image (used as a CSS mask)
  // tinted with its colour.
  gonfalonBackground: ResolvedBannerLayer;
  gonfalonDetail: ResolvedBannerLayer;
  decalBackground: ResolvedBannerLayer;
  decalForeground: ResolvedBannerLayer;
};

function rgb(c: ClanBannerColor): string {
  return `rgb(${c.colorR}, ${c.colorG}, ${c.colorB})`;
}

export async function resolveClanBanner(
  data: ClanBannerData
): Promise<ResolvedClanBanner | null> {
  const src = await getClanBannerSource();
  if (!src) return null;

  const gonfalon = src.gonfalons.find((g) => g.id === data.gonfalonId);
  const gonfalonCol = src.gonfalonColors.find(
    (c) => c.id === data.gonfalonColorId
  );
  const detail = src.gonfalonDetails.find(
    (d) => d.id === data.gonfalonDetailId
  );
  const detailCol = src.gonfalonDetailColors.find(
    (c) => c.id === data.gonfalonDetailColorId
  );
  const decal = src.decals.find((d) => d.id === data.decalId);
  const decalPri = src.decalPrimaryColors.find(
    (c) => c.id === data.decalColorId
  );
  const decalSec = src.decalSecondaryColors.find(
    (c) => c.id === data.decalBackgroundColorId
  );

  // Don't bail on missing single pieces - Bungie occasionally reissues banner
  // assets and old clans reference IDs that no longer exist in the source.
  // Fall back to whichever palette entry / asset is closest. Only abandon
  // composition entirely if we can't find the gonfalon (the base layer).
  if (!gonfalon) return null;

  const fallbackColor = gonfalonCol ?? src.gonfalonColors[0];
  if (!fallbackColor) return null;

  const primaryColor = decalPri ?? decalSec ?? fallbackColor;
  const secondaryColor = decalSec ?? decalPri ?? fallbackColor;
  const detailColor = detailCol ?? fallbackColor;

  return {
    gonfalonBackground: {
      imageUrl:
        cdn(gonfalon.foregroundPath) ?? cdn(gonfalon.backgroundPath) ?? "",
      color: rgb(gonfalonCol ?? fallbackColor),
    },
    gonfalonDetail: detail
      ? {
          imageUrl:
            cdn(detail.foregroundPath) ?? cdn(detail.backgroundPath) ?? "",
          color: rgb(detailColor),
        }
      : {
          imageUrl: "",
          color: rgb(detailColor),
        },
    decalBackground: decal
      ? {
          imageUrl: cdn(decal.backgroundPath) ?? cdn(decal.foregroundPath) ?? "",
          color: rgb(secondaryColor),
        }
      : { imageUrl: "", color: rgb(secondaryColor) },
    decalForeground: decal
      ? {
          imageUrl: cdn(decal.foregroundPath) ?? cdn(decal.backgroundPath) ?? "",
          color: rgb(primaryColor),
        }
      : { imageUrl: "", color: rgb(primaryColor) },
  };
}

// ---------- Loadout ----------

export type SlotPlug = {
  plugHash: number;
  name: string;
  icon: string | null;
  isEnhanced: boolean;
};

export type LoadoutSlot = {
  bucketHash: number;
  itemHash: number;
  itemInstanceId?: string;
  name: string;
  icon: string | null;
  // "Hand Cannon", "Helmet", etc.
  typeName?: string;
  tierType: number;
  isExotic: boolean;
  // Bungie sets ItemState.Masterwork (bit 4) on `state` for fully-leveled
  // armor (energy capacity 10) and weapons with their masterwork complete.
  // Drives the gold glow around the icon.
  isMasterworked: boolean;
  // Equipped perks / mods, ordered as they sit on the item. Empty for items
  // whose sockets we couldn't resolve. Used by the modal - kept off the
  // compact card so it stays small.
  plugs: SlotPlug[];
  // Equipped non-default ornament icon, when one is present. Renderers can
  // show this as the primary image and swap to the base icon on hover.
  ornamentIcon?: string | null;
};

// DestinyItemState flags. We only care about Masterwork right now but
// document the rest so the bitmask check is self-explanatory.
const ITEM_STATE_MASTERWORK = 4;

export type LoadoutStats = {
  health: number;
  melee: number;
  grenade: number;
  super: number;
  class: number;
  weapons: number;
};

export type CharacterLoadout = {
  characterId: string;
  classType: number;
  className: string;
  power: number;
  kinetic?: LoadoutSlot;
  energy?: LoadoutSlot;
  power_weapon?: LoadoutSlot;
  helmet?: LoadoutSlot;
  gauntlets?: LoadoutSlot;
  chest?: LoadoutSlot;
  legs?: LoadoutSlot;
  classArmor?: LoadoutSlot;
  // Equipped subclass (e.g. Nightstalker, Solar Warlock). Shown as its own
  // row in the modal so it sits visually adjacent to the gameplay loadout.
  subclass?: LoadoutSlot;
  // Most striking exotic armor piece - surfaced as a separate field for
  // cards that only want to show one armor highlight rather than all five.
  exoticArmor?: LoadoutSlot;
  // Six character tier stats. Each value is 0-100 (Bungie's already
  // tier-collapsed representation, where each 10 = one tier).
  stats: LoadoutStats;
};

export async function getLoadout(
  membership: DestinyMembership
): Promise<CharacterLoadout | null> {
  type EquipItem = {
    itemHash?: number;
    itemInstanceId?: string;
    bucketHash?: number;
  };
  type Socket = {
    plugHash?: number;
    isEnabled?: boolean;
    isVisible?: boolean;
  };
  type Resp = {
    characters?: { data?: Record<string, Character> };
    characterEquipment?: {
      data?: Record<string, { items?: EquipItem[] }>;
    };
    // Component 305 = per-instance socket plug data, keyed by itemInstanceId.
    // Component 300 = per-instance state flags + energy capacity + damage info.
    itemComponents?: {
      sockets?: {
        data?: Record<string, { sockets?: Socket[] }>;
      };
      instances?: {
        data?: Record<
          string,
          {
            state?: number;
            energy?: { energyCapacity?: number };
          }
        >;
      };
    };
  };
  let data: Resp;
  try {
    data = await bungieFetch<Resp>(
      `/Destiny2/${membership.membershipType}/Profile/${membership.membershipId}/?components=200,205,300,305`,
      { cacheSeconds: 60 }
    );
  } catch {
    return null;
  }

  const chars = data.characters?.data ?? {};
  const sorted = Object.values(chars).sort(
    (a, b) =>
      new Date(b.dateLastPlayed).getTime() -
      new Date(a.dateLastPlayed).getTime()
  );
  const active = sorted[0];
  if (!active) return null;

  const equipment =
    data.characterEquipment?.data?.[active.characterId]?.items ?? [];
  const socketsData = data.itemComponents?.sockets?.data ?? {};
  const instancesData = data.itemComponents?.instances?.data ?? {};

  // Resolve item definitions in parallel - React.cache + the 24h fetch
  // cache make this very cheap on repeat views.
  const defs = await Promise.all(
    equipment.map((e) =>
      e.itemHash
        ? resolveInventoryItem(e.itemHash).then((def) => ({ e, def }))
        : Promise.resolve({ e, def: null })
    )
  );

  // Resolve every unique plug hash across every equipped item up front. One
  // batched fetch per unique plug; cached for 24h after.
  const allPlugHashes = new Set<number>();
  for (const e of equipment) {
    if (!e.itemInstanceId) continue;
    const sockets = socketsData[e.itemInstanceId]?.sockets ?? [];
    for (const s of sockets) {
      if (s.plugHash && s.isVisible !== false) {
        allPlugHashes.add(s.plugHash);
      }
    }
  }
  const plugDefArr = await Promise.all(
    [...allPlugHashes].map((h) =>
      resolveInventoryItem(h).then((def) => [h, def] as const)
    )
  );
  const plugDefs = new Map(plugDefArr);

  // Sockets we want to surface as visible "perks" on weapons or "mods" on
  // armor. We skip cosmetic ornaments, shaders, trackers, crafting-only
  // categories, AND masterwork plugs (the diamond-bordered "armor is
  // masterworked" indicator is on every fully-leveled armor piece and
  // just adds noise to the perk bar).
  const skipCategories = [
    "shader",
    "ornament",
    "skin",
    "tracker",
    "memento",
    "deepsight",
    "crafting",
    "masterworks",
    "masterwork",
    "intrinsics",
  ];

  const buildPlugs = (instanceId: string | undefined): SlotPlug[] => {
    if (!instanceId) return [];
    const sockets = socketsData[instanceId]?.sockets ?? [];
    const out: SlotPlug[] = [];
    for (const s of sockets) {
      if (!s.plugHash || s.isVisible === false) continue;
      const def = plugDefs.get(s.plugHash);
      if (!def) continue;
      const cat = def.plug?.plugCategoryIdentifier?.toLowerCase() ?? "";
      if (skipCategories.some((kw) => cat.includes(kw))) continue;
      // Filter out empty mod / no-perk placeholders. They cover the
      // un-customised state of armor mod slots (and crafted weapon slots) -
      // listing them is noise, and they all share the same plug hash so
      // they'd collide on React keys without the synthetic index either way.
      const lowerName = def.displayProperties?.name?.toLowerCase() ?? "";
      if (
        cat.includes("empty") ||
        cat.endsWith(".v400.empty.mod_socket") ||
        lowerName.includes("empty") ||
        lowerName.startsWith("no ")
      ) {
        continue;
      }
      // Drop plugs without icons - usually default kinetic/energy "slot"
      // anchor entries Bungie ships at hash 0-ish.
      if (!def.displayProperties?.icon) continue;
      out.push({
        plugHash: s.plugHash,
        name: def.displayProperties?.name ?? "Unknown",
        icon: cdn(def.displayProperties.icon),
        isEnhanced: isEnhancedPlug(def),
      });
    }
    return out;
  };

  // Ornament lookup. Walks the sockets we'd otherwise skip and returns the
  // first ornament-category plug that isn't a "Default Ornament" placeholder.
  // One pass per item, all defs already cached.
  const findOrnamentIcon = (instanceId: string | undefined): string | null => {
    if (!instanceId) return null;
    const sockets = socketsData[instanceId]?.sockets ?? [];
    for (const s of sockets) {
      if (!s.plugHash || s.isVisible === false) continue;
      const def = plugDefs.get(s.plugHash);
      if (!def?.displayProperties?.icon) continue;
      const cat = def.plug?.plugCategoryIdentifier?.toLowerCase() ?? "";
      const looksLikeOrnament =
        cat.includes("armor_skins") ||
        cat.includes("ornament") ||
        cat.includes("skins");
      if (!looksLikeOrnament) continue;
      const lname = def.displayProperties.name?.toLowerCase() ?? "";
      if (lname.includes("default") || lname.includes("empty")) continue;
      return cdn(def.displayProperties.icon);
    }
    return null;
  };

  // Armor bucket set - used to gate the energy-capacity check below since
  // weapons don't have an energy field. (Weapons rely on the state bit
  // exclusively.)
  const ARMOR_BUCKETS = new Set<number>([
    BUCKET_HELMET,
    BUCKET_GAUNTLETS,
    BUCKET_CHEST,
    BUCKET_LEG,
    BUCKET_CLASS_ARMOR,
  ]);

  const toSlot = (
    e: EquipItem,
    def: InventoryItemDefinition | null
  ): LoadoutSlot | undefined => {
    if (!e.itemHash || !def || e.bucketHash === undefined) return undefined;
    const tier = def.inventory?.tierType ?? 0;
    const instance = e.itemInstanceId
      ? instancesData[e.itemInstanceId]
      : undefined;
    const state = instance?.state ?? 0;
    const energyCapacity = instance?.energy?.energyCapacity ?? 0;
    const plugs = buildPlugs(e.itemInstanceId);

    // Masterwork detection. Two definitive signals - no plug-category
    // guessing here, because most armor pieces have a "masterwork" plug
    // socket regardless of tier and a category-substring check returns true
    // for every armor piece in the game.
    //
    //   1. Bit 4 on `state` (ItemState.Masterwork). Authoritative for
    //      weapons; sometimes set on armor too.
    //   2. Armor only: `energy.energyCapacity === 10`. That's the literal
    //      Bungie definition of "this armor piece is masterworked".
    const isArmor = ARMOR_BUCKETS.has(e.bucketHash);
    const masterworkedByState =
      (state & ITEM_STATE_MASTERWORK) === ITEM_STATE_MASTERWORK;
    const masterworkedByEnergy = isArmor && energyCapacity >= 10;

    return {
      bucketHash: e.bucketHash,
      itemHash: e.itemHash,
      itemInstanceId: e.itemInstanceId,
      name: def.displayProperties?.name ?? "Unknown",
      icon: def.displayProperties?.icon
        ? cdn(def.displayProperties.icon)
        : null,
      typeName: def.itemTypeDisplayName,
      tierType: tier,
      isExotic: tier === TIER_EXOTIC,
      isMasterworked: masterworkedByState || masterworkedByEnergy,
      plugs,
      ornamentIcon: findOrnamentIcon(e.itemInstanceId),
    };
  };

  const slots: Partial<CharacterLoadout> = {};
  for (const { e, def } of defs) {
    const slot = toSlot(e, def);
    if (!slot) continue;
    switch (e.bucketHash) {
      case BUCKET_KINETIC: slots.kinetic = slot; break;
      case BUCKET_ENERGY: slots.energy = slot; break;
      case BUCKET_POWER: slots.power_weapon = slot; break;
      case BUCKET_HELMET: slots.helmet = slot; break;
      case BUCKET_GAUNTLETS: slots.gauntlets = slot; break;
      case BUCKET_CHEST: slots.chest = slot; break;
      case BUCKET_LEG: slots.legs = slot; break;
      case BUCKET_CLASS_ARMOR: slots.classArmor = slot; break;
      case BUCKET_SUBCLASS: slots.subclass = slot; break;
    }
  }

  // Pick whichever armor piece is exotic - every loadout has exactly one,
  // and surfacing it as a flat field makes the UI render trivial.
  const armorOrder = [
    slots.helmet,
    slots.gauntlets,
    slots.chest,
    slots.legs,
    slots.classArmor,
  ];
  const exoticArmor = armorOrder.find((s) => s?.isExotic);

  const stats: LoadoutStats = {
    health: active.stats?.[STAT_HASHES.health] ?? 0,
    melee: active.stats?.[STAT_HASHES.melee] ?? 0,
    grenade: active.stats?.[STAT_HASHES.grenade] ?? 0,
    super: active.stats?.[STAT_HASHES.super] ?? 0,
    class: active.stats?.[STAT_HASHES.class] ?? 0,
    weapons: active.stats?.[STAT_HASHES.weapons] ?? 0,
  };

  return {
    characterId: active.characterId,
    classType: active.classType,
    className: CLASS_NAMES[active.classType] ?? "Guardian",
    power: active.light,
    exoticArmor,
    stats,
    ...slots,
  };
}

// Look up an emblem's full inventory-item definition. Cached for 24h since
// emblem art doesn't change.
export const resolveEmblemDefinition = cache(
  async (hash: number): Promise<EmblemDefinition | null> => {
    try {
      return await bungieFetch<EmblemDefinition>(
        `/Destiny2/Manifest/DestinyInventoryItemDefinition/${hash}/`,
        { cacheSeconds: 60 * 60 * 24 }
      );
    } catch {
      return null;
    }
  }
);

// Look up activity definitions, chunked so we don't open dozens of concurrent
// Cloudflare connections at once (which was triggering UND_ERR_CONNECT_TIMEOUT
// in dev). Manifest entries are effectively immutable, so we cache them for
// a full day at the data-cache layer.
const DEFINITION_CONCURRENCY = 4;

export async function resolveActivityDefinitions(
  hashes: number[]
): Promise<Map<number, ActivityDefinition>> {
  const unique = [...new Set(hashes)];
  const map = new Map<number, ActivityDefinition>();

  for (let i = 0; i < unique.length; i += DEFINITION_CONCURRENCY) {
    const slice = unique.slice(i, i + DEFINITION_CONCURRENCY);
    const defs = await Promise.all(
      slice.map((hash) =>
        bungieFetch<ActivityDefinition>(
          `/Destiny2/Manifest/DestinyActivityDefinition/${hash}/`,
          { cacheSeconds: 60 * 60 * 24 }
        ).catch(() => null)
      )
    );
    slice.forEach((hash, idx) => {
      const def = defs[idx];
      if (def) map.set(hash, def);
    });
  }
  return map;
}

export function cdn(path: string | undefined | null): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${BUNGIE_CDN}${path}`;
}

export const CLASS_NAMES: Record<number, string> = {
  0: "Titan",
  1: "Hunter",
  2: "Warlock",
};

// Per-activity-hash lifetime completion counts, summed across every character.
// AggregateActivityStats gives a row per activity hash the player has ever
// touched, which is exactly what we need to count clears of a specific raid.
export async function getAggregateActivityClears(
  membership: DestinyMembership,
  characters: Character[]
): Promise<Map<number, number>> {
  type AggregateRow = {
    activityHash: number;
    values: {
      activityCompletions?: { basic: { value: number } };
    };
  };
  type Resp = { activities?: AggregateRow[] };

  // Sequence per-character so we never have more than one aggregate-stats call
  // open at a time. Each response is fairly chunky (Bungie returns a row per
  // activity hash ever touched), so serializing is gentler on the connection
  // pool than running three in parallel.
  const perChar: Resp[] = [];
  for (const c of characters) {
    const r = await bungieFetch<Resp>(
      `/Destiny2/${membership.membershipType}/Account/${membership.membershipId}/Character/${c.characterId}/Stats/AggregateActivityStats/`,
      // Short TTL: this powers the lifetime CLEARS counter on every activity
      // card, and lifts after a fresh clear ~30s after AutoRefresh ticks.
      { cacheSeconds: 30 }
    ).catch(() => ({ activities: [] as AggregateRow[] }));
    perChar.push(r);
  }

  const totals = new Map<number, number>();
  for (const r of perChar) {
    for (const row of r.activities ?? []) {
      const n = row.values.activityCompletions?.basic.value ?? 0;
      if (!n) continue;
      totals.set(row.activityHash, (totals.get(row.activityHash) ?? 0) + n);
    }
  }
  return totals;
}

// raid.report / dungeon.report / etc all use a short platform slug.
export function platformSlug(membershipType: number): string {
  switch (membershipType) {
    case 1: return "xb";
    case 2: return "ps";
    case 3: return "pc";
    case 4: return "bnet";
    case 5: return "stadia";
    case 6: return "egs";
    default: return "pc";
  }
}
