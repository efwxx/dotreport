// Bungie API client — server-side only.
// Docs: https://bungie-net.github.io/

import { cache } from "react";

const BUNGIE_BASE = "https://www.bungie.net/Platform";
const BUNGIE_CDN = "https://www.bungie.net";

// Activity mode IDs we care about.
// https://bungie-net.github.io/multi/schema_Destiny-HistoricalStats-Definitions-DestinyActivityModeType.html
export const MODE_RAID = 4;
export const MODE_DUNGEON = 82;

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
  // once — a single retry after a brief backoff handles the common case.
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
};

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
      // next AutoRefresh tick. Only the first page is hot — deeper pages are
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
  // player at least — true team-flawless would require fetching the PGCR).
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
// activity the player may not have run recently — we'll dig back through a
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
// of the supplement is silent — we still return the active-character total.
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

export type ActivityDefinition = {
  hash: number;
  displayProperties: { name: string; description: string; icon?: string };
  pgcrImage?: string;
  // Mode classification — used to filter aggregate-stats hashes down to
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
