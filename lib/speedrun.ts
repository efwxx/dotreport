// speedrun.com client. Read-only.
//
// Auth: an API key isn't strictly required for the public /personal-bests
// endpoint, but providing one gives us higher rate limits and unlocks the
// /profile lookup (so the username doesn't have to be hardcoded). Get a key
// from https://www.speedrun.com/api/auth while logged in.
//
// Game / category resolution strategy:
//   We request /personal-bests with `embed=game,category,players` so the
//   round-trip *should* return embedded objects. In practice the embed
//   sometimes silently fails (the response holds plain ID strings instead of
//   nested `{ data: ... }` objects). When that happens we fall back to one
//   /games/{id} + /categories/{id} request per unique resource, wrapped in
//   React.cache so identical IDs hit the network exactly once per render and
//   cache for 24h server-side beyond that.

import { cache } from "react";

const SRC_BASE = "https://www.speedrun.com/api/v1";

export type SpeedrunPersonalBest = {
  runId: string;
  place: number;
  timeSeconds: number;
  timeDisplay: string;
  gameName: string;
  gameUrl?: string;
  gameCover?: string;
  categoryName: string;
  runUrl: string;
  date?: string;
  coop: boolean;
};

type EmbedShape<T> = string | { data: T | T[] | null };

type RawGame = {
  id: string;
  names: { international?: string; twitch?: string };
  weblink?: string;
  assets?: {
    "cover-small"?: { uri?: string };
    "cover-medium"?: { uri?: string };
    icon?: { uri?: string };
  };
};

type RawCategory = {
  id: string;
  name: string;
};

type RawPb = {
  place: number;
  run: {
    id: string;
    weblink: string;
    times: { primary: string; primary_t: number };
    date?: string;
    game: EmbedShape<RawGame>;
    category: EmbedShape<RawCategory>;
    players?: EmbedShape<{ id?: string; name?: string }>;
  };
};

async function fetchSrc<T>(
  path: string,
  options: { cacheSeconds?: number } = {}
): Promise<T | null> {
  const { cacheSeconds = 600 } = options;
  const apiKey = process.env.SPEEDRUN_API_KEY?.trim();
  const headers: Record<string, string> = {
    Accept: "application/json",
    // speedrun.com asks API consumers to identify themselves. A static
    // string is fine; helps them debug abuse without affecting us.
    "User-Agent": "dotreport/1.0 (+github.com/yourname/dotreport)",
  };
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }
  try {
    const res = await fetch(`${SRC_BASE}${path}`, {
      headers,
      next: { revalidate: cacheSeconds },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function formatTime(seconds: number): string {
  if (!seconds || seconds <= 0) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds - Math.floor(seconds)) * 1000);
  const pad = (n: number, w = 2) => n.toString().padStart(w, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  if (m > 0) {
    return ms ? `${m}:${pad(s)}.${pad(ms, 3)}` : `${m}:${pad(s)}`;
  }
  return ms ? `${s}.${pad(ms, 3)}s` : `${s}s`;
}

function unwrapEmbed<T>(e: EmbedShape<T> | undefined): T | null {
  if (!e) return null;
  if (typeof e === "string") return null;
  const d = e.data;
  if (!d) return null;
  return Array.isArray(d) ? (d[0] ?? null) : d;
}

function pickGameCover(game: RawGame | null): string | undefined {
  if (!game?.assets) return undefined;
  return (
    game.assets["cover-small"]?.uri ||
    game.assets["cover-medium"]?.uri ||
    game.assets.icon?.uri ||
    undefined
  );
}

// Direct-fetch fallbacks for when the embed silently fails. React.cache()
// dedupes identical IDs within a single render; the underlying fetch is
// cached for 24h server-side beyond that.
const fetchGameById = cache(
  async (id: string): Promise<RawGame | null> => {
    const data = await fetchSrc<{ data?: RawGame }>(`/games/${id}`, {
      cacheSeconds: 60 * 60 * 24,
    });
    return data?.data ?? null;
  }
);

const fetchCategoryById = cache(
  async (id: string): Promise<RawCategory | null> => {
    const data = await fetchSrc<{ data?: RawCategory }>(`/categories/${id}`, {
      cacheSeconds: 60 * 60 * 24,
    });
    return data?.data ?? null;
  }
);

async function resolveGame(
  field: EmbedShape<RawGame> | undefined
): Promise<RawGame | null> {
  if (!field) return null;
  if (typeof field === "string") return await fetchGameById(field);
  return unwrapEmbed(field);
}

async function resolveCategory(
  field: EmbedShape<RawCategory> | undefined
): Promise<RawCategory | null> {
  if (!field) return null;
  if (typeof field === "string") return await fetchCategoryById(field);
  return unwrapEmbed(field);
}

export async function getAuthenticatedUsername(): Promise<string | null> {
  if (!process.env.SPEEDRUN_API_KEY?.trim()) return null;
  type Resp = {
    data?: {
      names?: { international?: string; twitch?: string };
    };
  };
  const data = await fetchSrc<Resp>("/profile", { cacheSeconds: 3600 });
  return (
    data?.data?.names?.international ||
    data?.data?.names?.twitch ||
    null
  );
}

export async function getPersonalBests(
  username: string,
  limit = 5
): Promise<SpeedrunPersonalBest[]> {
  const user = encodeURIComponent(username);
  // Hand-built URL — URLSearchParams encodes commas to %2C and speedrun.com
  // drops the embed silently when that happens.
  const path = `/users/${user}/personal-bests?embed=game,category,players`;

  const data = await fetchSrc<{ data?: RawPb[] }>(path);
  if (!data) return [];
  const raws = (data.data ?? [])
    .sort((a, b) => a.place - b.place)
    .slice(0, limit);

  // Resolve game + category for each PB in parallel. Pre-embedded objects
  // return immediately; string IDs trigger one cached follow-up request per
  // unique resource.
  const mapped = await Promise.all(
    raws.map(async (r) => {
      const [game, category] = await Promise.all([
        resolveGame(r.run.game),
        resolveCategory(r.run.category),
      ]);

      const players = r.run.players;
      const playerArr =
        typeof players === "object" &&
        players !== null &&
        Array.isArray(players.data)
          ? players.data
          : [];

      return {
        runId: r.run.id,
        place: r.place,
        timeSeconds: r.run.times.primary_t,
        timeDisplay: formatTime(r.run.times.primary_t),
        gameName:
          game?.names?.international ||
          game?.names?.twitch ||
          "Unknown game",
        gameUrl: game?.weblink,
        gameCover: pickGameCover(game),
        categoryName: category?.name || "Run",
        runUrl: r.run.weblink,
        date: r.run.date,
        coop: playerArr.length > 1,
      } satisfies SpeedrunPersonalBest;
    })
  );

  return mapped;
}
