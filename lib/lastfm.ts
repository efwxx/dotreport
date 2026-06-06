// Last.fm client - server-side only.
// Docs: https://www.last.fm/api/show/user.getRecentTracks

const LASTFM_BASE = "https://ws.audioscrobbler.com/2.0/";

export type Track = {
  name: string;
  artist: string;
  album: string;
  url: string;
  image: string | null;
  nowPlaying: boolean;
  // Unix seconds; undefined when nowPlaying.
  playedAt?: number;
};

type LfmImage = { size: string; "#text": string };
type LfmTrack = {
  name: string;
  artist: { "#text": string } | string;
  album: { "#text": string };
  url: string;
  image: LfmImage[];
  date?: { uts: string };
  "@attr"?: { nowplaying?: string };
};

function pickImage(images: LfmImage[]): string | null {
  if (!images?.length) return null;
  // Prefer "extralarge" then "large" then anything non-empty.
  const order = ["extralarge", "large", "medium", "small"];
  for (const size of order) {
    const found = images.find((i) => i.size === size && i["#text"]);
    if (found) return found["#text"];
  }
  return images.find((i) => i["#text"])?.["#text"] ?? null;
}

export async function getRecentTrack(): Promise<Track | null> {
  const apiKey = process.env.LASTFM_API_KEY;
  const user = process.env.LASTFM_USERNAME;
  if (!apiKey) throw new Error("LASTFM_API_KEY is not set");
  if (!user) throw new Error("LASTFM_USERNAME is not set");

  const url = new URL(LASTFM_BASE);
  url.searchParams.set("method", "user.getrecenttracks");
  url.searchParams.set("user", user);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString(), {
    // Now-playing changes frequently - keep this short.
    next: { revalidate: 30 },
  });
  if (!res.ok) {
    throw new Error(`Last.fm API failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as {
    recenttracks?: { track?: LfmTrack | LfmTrack[] };
  };
  const raw = data.recenttracks?.track;
  if (!raw) return null;
  const track = Array.isArray(raw) ? raw[0] : raw;
  if (!track) return null;

  const artist =
    typeof track.artist === "string" ? track.artist : track.artist["#text"];

  return {
    name: track.name,
    artist,
    album: track.album["#text"],
    url: track.url,
    image: pickImage(track.image),
    nowPlaying: track["@attr"]?.nowplaying === "true",
    playedAt: track.date ? parseInt(track.date.uts, 10) : undefined,
  };
}
