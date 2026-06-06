# dotreport

[![View Example](https://img.shields.io/badge/view_example-docslave.nl-8b5cf6?style=for-the-badge)](https://docslave.nl)

A report-style profile page with live data from the Bungie, Last.fm, and
speedrun.com APIs. Config-driven layout, multi-account support, dot-chart
activity strips, a live in-game activity card (current activity + fireteam +
elapsed timer), PvP / Gambit trackers, speedrun.com personal-best widget,
auto-refreshing data, click-to-copy Bungie tags, dynamic emblem updates
(even in the website icon!), and a project showcase.

Built with Next.js. All third-party calls happen on the server, so your API
keys never reach the browser. The only client JavaScript is the copy buttons,
the elapsed-time tick on the live activity card, and a background polling
loop that refreshes data without reloading the page.

---

## Table of contents

- [Quickstart](#quickstart)
- [What you have to edit](#editing)
- [`.env.local` reference](#env-reference)
- [`config/site.ts` reference](#layout-reference)
- [Section catalog](#sections)
- [Visual indicators on dots](#dot-indicators)
- [Project structure](#project-structure)
- [Recipes](#recipes)
- [Deploy](#deploy)
- [Known limitations](#limitations)

---

<a id="quickstart"></a>
## Quickstart

```bash
# 1. Install
npm install

# 2. Create your env file
cp .env.example .env.local
#    …then fill in the four required values (see below).

# 3. Run
npm run dev
#    Open http://localhost:3000
```

You need exactly **two files** filled in to make the site yours:

1. **`.env.local`**, secrets, account info, defaults.
2. **`config/site.ts`**, page layout (what cards appear, in what order).

Everything else is implementation and rarely needs touching.

---

<a id="editing"></a>
## What you have to edit

### Required to run at all

In `.env.local`:

| Variable          | What                                                       | Where to get it |
| ----------------- | ---------------------------------------------------------- | --------------- |
| `BUNGIE_API_KEY`  | Your Bungie.net application key.                           | https://www.bungie.net/en/Application, any app, no callback URL needed. |
| `BUNGIE_NAME`     | The part of your Bungie tag before the `#`.                | In-game roster / bungie.net profile. |
| `BUNGIE_CODE`     | The 4-digit part after the `#`. Leading zeros are fine.    | Same. |
| `LASTFM_API_KEY`  | Last.fm API key.                                           | https://www.last.fm/api/account/create, any app name, callback URL irrelevant. |
| `LASTFM_USERNAME` | Your Last.fm handle.                                       | Your profile. |

That's enough to see the hero card, the default activity strip, now playing,
and the auto-generated link pills.

### To make it actually yours

Edit `config/site.ts` to choose what appears on the page (see
[Section catalog](#sections) below). The defaults give you a hero, a
link row, a tracked-activity strip + now-playing pair, and a Projects section
with a single placeholder card, swap in your own projects there.

Everything else in this README is reference for going deeper.

---

<a id="env-reference"></a>
## `.env.local` reference

```env
# ---------- Required ----------
BUNGIE_API_KEY=...
BUNGIE_NAME=Yura
BUNGIE_CODE=0618          # leading zeros OK; padded everywhere it's shown
LASTFM_API_KEY=...
LASTFM_USERNAME=...

# ---------- Multiple accounts (optional, unlimited) ----------
# Reference these from config/site.ts with `account: 2`, `account: 3`, etc.
# BUNGIE_NAME_2=
# BUNGIE_CODE_2=
# BUNGIE_NAME_3=
# BUNGIE_CODE_3=

# ---------- Display ----------
# Override the hero card name + browser tab title.
# Each account can have its own DISPLAY_NAME_<n>.
DISPLAY_NAME=[...]
# DISPLAY_NAME_2=
# DISPLAY_NAME_3=

# ---------- Optional: speedrun.com ----------
# Speedrun.com profile handle (public; no key needed). Used by the
# `{ type: "speedrun" }` section to look up your PBs.
# SPEEDRUN_USERNAME=
# Optional speedrun.com API key (https://www.speedrun.com/api/auth). Buys
# you higher rate limits and lets the speedrun section auto-resolve your
# username from /profile when SPEEDRUN_USERNAME is unset.
# SPEEDRUN_API_KEY=

# ---------- Tracked-activity defaults ----------
# Default values for `{ type: "activity" }` sections that don't set anything
# inline. Override per-section from config/site.ts when needed.

# Substring matched against an activity's Bungie display name. Catches every
# difficulty / reissue (Normal, Master, Challenge weeks). Set to "*" or
# leave blank for wildcard mode (any raid or dungeon, total = lifetime).
TRACKED_ACTIVITY_NAME=*

# "raid" or "dungeon", auto-detected per-section from the matched activity
# when set inline, so this is really just the wildcard mode picker.
TRACKED_ACTIVITY_MODE=raid

# Card title; defaults to "Recent <name>" / "Recent Raids" / "Recent Dungeons".
TRACKED_ACTIVITY_TITLE=Recent Raid Clears

# ---------- Link pills ----------
# Hide the auto-generated Join Code / Raid Report / Last.fm defaults.
DISABLE_DEFAULT_LINKS=true

# Extra link pills, indexed. Up to 20 (EXTRA_LINK_1 .. EXTRA_LINK_20).
# Format: "Label|value". Numbering gaps are fine.
# - Normal pill (anchor):     EXTRA_LINK_1=Steam|https://steamcommunity.com/id/me
# - Discord pill (copy):      EXTRA_LINK_3=Discord|myusername
#   Special case: a pill labelled "Discord" (any case) does not open a URL,
#   clicking copies the value to the clipboard. Use for handles, not invites.
EXTRA_LINK_1=Steam|https://steamcommunity.com/id/yourname/
EXTRA_LINK_2=Spotify|https://open.spotify.com/user/yourid
EXTRA_LINK_3=Discord|yourname
```

---

<a id="layout-reference"></a>
## `config/site.ts` reference

This file is the entire page layout, as a single TypeScript array. Sections
render top-to-bottom; `row` packs two children side by side. Everything is
hot-reloaded by `next dev`, save the file and the page updates.

```ts
// Site layout configuration.
//
// This is the single file you edit to add/remove/reorder sections on the
// page. Sections render top-to-bottom; use `row` to put two cards side by
// side. The shape of each section is documented in `lib/sections.ts`.

import type { SectionDef } from "@/lib/sections";

export const sections: SectionDef[] = [
  { type: "hero", account: 1 },
  { type: "links" },
  {
    type: "row",
    columns: [
      { type: "activity" },
      { type: "nowPlaying" },
    ],
  },
];
```

The shape of each section is enforced by `SectionDef` in `lib/sections.ts`,
so your editor autocompletes the available fields.

---

<a id="sections"></a>
## Section catalog

| Type | Fields | Renders |
|---|---|---|
| `hero` | `account?`, `displayName?` | Big card with the equipped emblem as background. Account-aware. With 2+ heroes anywhere in the config, the name itself becomes a click-to-copy target for each card's Bungie tag. |
| `links` | — | Row of pill links. Defaults (Join Code / Raid Report / Last.fm) follow the first hero's account. Extras come from `EXTRA_LINK_*` env vars. The Join Code pill disappears in multi-hero mode (each hero has its own click-to-copy name instead). |
| `activity` | `name?`, `mode?`, `title?`, `account?` | Dot-chart strip of 10 most recent clears + lifetime count + **fastest recent clear**. `name` is a substring match (catches every difficulty/reissue). `mode` auto-detects from the matched activity, so dungeons "just work". `account` indexes into `BUNGIE_NAME_<n>`. |
| `liveActivity` | `account?`, `title?`, `orbitImage?` | **Live in-game activity card.** Shows current activity name, PGCR image, ticking elapsed timer, and fireteam member list when the player is online. Quietly degrades to an `ORBIT` chip (with the orbit image) when out of activity, and to `OFFLINE` when the player isn't logged in. PvP playlist matches show both the map and the playlist (`The Burnout` / `TRIALS OF OSIRIS`). |
| `pvp` | `mode?`, `title?`, `account?` | **Win/loss dot-chart strip** for a Crucible / Trials / Iron Banner / Gambit playlist. Headline stats: lifetime K/D + win rate. Dots green for wins, red for losses, positioned vertically by K/D. Gambit dots are non-clickable; other modes link to raid.report's PGCR page. |
| `speedrun` | `username?`, `title?`, `limit?` | **Speedrun.com personal-bests card.** Game cover thumbnails, place badges (gold/silver/bronze for top 3), category, time, date. WRs counter in the header. Uses `SPEEDRUN_API_KEY` if set, else falls back to public API. |
| `nowPlaying` | — | Last.fm card showing the currently-playing or most-recent track. Live indicator pulses red when actively scrobbling. |
| `projects` | `title?`, `items[]` | Grid of project cards. Each item: `{ title, description?, href?, tags?, icon? }`. Cards are clickable if `href` is set. |
| `text` | `title?`, `body` | Free-form text card. Useful for an "About" blurb or attribution. |
| `row` | `columns[]` | Two-column wrapper. Stacks to one column under 620px. Children can be any other section type. |

**Wildcard activity mode.** Setting `name: ""` or `name: "*"` (or the env var
to the same) turns an activity section into a "10 most recent raid/dungeon
clears of any kind" card. The CLEARS count becomes lifetime total for that
mode, including clears on deleted characters.

**Auto-refresh.** Every page mount installs a tiny background loop that calls
`router.refresh()` every 45 seconds (pauses while the tab is hidden, fires
immediately on tab return). Combined with the short fetch TTLs on activity
history (30s), aggregate stats (30s), live activity (15s), and Last.fm now
playing (30s), the page stays roughly in sync with reality without a manual
reload. Open the dashboard, finish a raid, alt-tab back, and the new clear
should show up within a refresh cycle.

**Multiple accounts.** Each `activity` and `hero` section accepts an
`account: <n>` field that points at `BUNGIE_NAME_<n>` / `BUNGIE_CODE_<n>` in
env. Unlimited accounts, just keep adding numbered pairs. Examples:

```ts
{ type: "hero" },                                              // account 1
{ type: "hero", account: 2 },                                  // account 2, second hero
{ type: "activity", name: "Vault of Glass", account: 2 },      // account 2's VoG
```

---

<a id="dot-indicators"></a>
## Visual indicators on dots

Each dot in an activity strip can carry up to two markers, surfaced both
visually and in the hover tooltip:

| Marker | Rule | Look |
|---|---|---|
| ★ (gold star) | **Raid:** ≤4 players. **Dungeon:** solo only. | Gold star at the dot's top-right. |
| Glow | Flawless (0 deaths) OR solo dungeon. | Soft gold halo around the dot. |
| Color | Master difficulty | Dot becomes purple instead of its mode color (green for raids, blue for dungeons). |

Fireteam labels in the tooltip use friendly names: **Solo / Duo / Trio / Quad**
for 1–4 players; 5–6 player full-team raid clears show no label.

Dots also link out: raid dots go to `raid.report/pgcr/{id}`, dungeon dots
to `dungeon.report/pgcr/{id}`. PvP / Crucible / Trials / Iron Banner dots
go to `raid.report/pgcr/{id}` too. **Gambit dots are non-clickable** since
there's no good public PGCR viewer that handles the mode well — they still
show their flyout on hover, just don't navigate anywhere.

### PvP strip indicators

PvP cards (Crucible, Trials, Iron Banner, Gambit) reuse the same dot strip
with a different palette and Y-axis:

| Marker | Rule |
|---|---|
| Green dot | Win (`standing === 0`). |
| Red dot   | Loss. |
| Y position | Per-match K/D, clamped to 0.5–2.5. |

Tooltip carries the map name, win/loss pill, K/D/A breakdown, duration,
and time ago.

---

<a id="project-structure"></a>
## Project structure

```
dotreport/
├── .env.example                   # documents every env var
├── .env.local                     # ← YOU CREATE THIS (from .env.example)
├── config/
│   └── site.ts                    # ← THE LAYOUT FILE you edit
├── public/
│   └── orbit.svg                  # default orbit-state image for live activity
├── lib/
│   ├── account.ts                 # account resolution + tag formatting helpers
│   ├── bungie.ts                  # Bungie API client (server-only)
│   ├── clipboard.ts               # client-side copy helper
│   ├── lastfm.ts                  # Last.fm API client (server-only)
│   ├── sections.ts                # SectionDef types, add new section kinds here
│   └── speedrun.ts                # speedrun.com API client (server-only)
├── app/
│   ├── layout.tsx                 # <title>, favicon (driven by first hero's account)
│   ├── page.tsx                   # thin shell, renders config/site.ts sections + AutoRefresh
│   ├── globals.css                # all styling
│   ├── api/
│   │   ├── destiny/route.ts       # /api/destiny, JSON of profile + recent VoG
│   │   └── nowplaying/route.ts    # /api/nowplaying, JSON of current track
│   └── components/
│       ├── Activities.tsx         # activity strip server component
│       ├── AutoRefresh.tsx        # background router.refresh() loop (client)
│       ├── ClearsStrip.tsx        # the dot chart itself
│       ├── CopyPill.tsx           # click-to-copy pill (Join Code, Discord)
│       ├── Hero.tsx               # emblem + name card
│       ├── HeroName.tsx           # click-to-copy hero name (multi-hero mode)
│       ├── Links.tsx              # link pill row
│       ├── LiveActivity.tsx       # current-activity card (server)
│       ├── LiveTimer.tsx          # ticking elapsed-time client component
│       ├── NowPlaying.tsx         # Last.fm card
│       ├── Projects.tsx           # project showcase
│       ├── PvpActivities.tsx      # PvP card (server)
│       ├── PvpStrip.tsx           # W/L dot chart
│       ├── Section.tsx            # section router, switches on SectionDef.type
│       └── Speedrun.tsx           # speedrun.com personal-bests card
└── package.json
```

### Where edits land

| Goal | File |
|---|---|
| Add your credentials / accounts | `.env.local` |
| Reorder, add, or remove sections | `config/site.ts` |
| Add a new project to the showcase | `config/site.ts` (the `projects.items` array) |
| Change the favicon source | `app/layout.tsx`, `generateMetadata` |
| Style tweaks (colors, sizes) | `app/globals.css` |
| Add a brand-new section type | `lib/sections.ts` + `app/components/Section.tsx` + your new component |
| Adjust low-man / flawless thresholds | `app/components/ClearsStrip.tsx` (`shouldShowStar`, `shouldGlow`) |
| Change deep-pagination depth | `lib/bungie.ts`, `getRecentClearsForActivity` (`maxPagesPerCharacter`) |
| Auto-refresh interval | `app/page.tsx`, `<AutoRefresh intervalSeconds={45} />` |
| Replace the orbit image | drop your own at `public/orbit.svg` (or whatever path you point `orbitImage:` to) |
| Tune the PvP K/D Y-axis range | `app/components/PvpStrip.tsx` (`KD_MIN`, `KD_MAX`) |

---

<a id="recipes"></a>
## Recipes

### Add a project

In `config/site.ts`, push a new entry into the existing `projects.items`:

```ts
{
  type: "projects",
  title: "Projects",
  items: [
    {
      icon: "<3",
      title: "title",
      description: "explain your project in small words.",
      href: "<link your project here>",
      tags: ["<add tags here>"],
    },
    // ...others
  ],
},
```

Every field except `title` is optional. Without `href`, the card renders
non-clickable (no arrow). Without `description`, only the title + tags show.

### Track another raid or dungeon

```ts
{
  type: "row",
  columns: [
    { type: "activity", name: "King's Fall", title: "KF" },
    { type: "activity", name: "Salvation's Edge", title: "SE" },
  ],
},
```

Mode auto-detects from the matched activity's definitions, so dungeons just
work, no `mode: "dungeon"` needed.

### Show a second account

`.env.local`:

```env
BUNGIE_NAME_2="2B"
BUNGIE_CODE_2=0224
DISPLAY_NAME_2="2B"        # optional
```

`config/site.ts`:

```ts
{ type: "hero", account: 2, displayName: "2B" },                       // alt hero
{ type: "activity", name: "Vault of Glass", account: 2, title: "VoG (2B)" },
```

With both `{ type: "hero" }` (account 1) and `{ type: "hero", account: 2 }`
in the config, the page enters multi-hero mode, each hero name becomes
click-to-copy, and the global Join Code pill disappears.

### Add a live activity card

Drop one into your row:

```ts
{
  type: "row",
  columns: [
    { type: "activity" },
    { type: "liveActivity" },
  ],
},
```

Requires the Bungie account's transitory privacy to be set to "All Users"
(default for most accounts). When in-game it shows the activity image,
ticking timer, and fireteam pills — when offline / in orbit it shows a
friendly placeholder. The default orbit image ships at `public/orbit.svg`;
override per-section with `orbitImage: "/your.jpg"`.

### Track a PvP playlist

```ts
{ type: "pvp", mode: "trials" },                      // Trials of Osiris
{ type: "pvp", mode: "ironBanner", title: "IB" },     // Iron Banner
{ type: "pvp", mode: "gambit" },                      // Gambit (dots non-clickable)
{ type: "pvp", mode: "crucible", account: 2 },        // alt account's Crucible
```

K/D + W RATE in the header, last-10-match dot strip below. Lifetime stats
come from Bungie's `/Stats` endpoint when available; otherwise the card
falls back to summing from the recent match pool so the numbers always
line up with the visible dots.

### Wire up speedrun.com

In `.env.local`:

```env
SPEEDRUN_USERNAME=yourhandle    # OR
SPEEDRUN_API_KEY=abc123...      # auto-resolves your name via /profile
```

In `config/site.ts`:

```ts
{ type: "speedrun", limit: 5 },                                // default
{ type: "speedrun", username: "mahq", limit: 3, title: "PBs" }, // override
```

Pulls personal bests, embeds game + category in a single request, falls
through to follow-up `/games/{id}` and `/categories/{id}` lookups if
speedrun.com drops the embed.

### Add a brand-new section type

Three small edits:

1. **`lib/sections.ts`**, add a variant to the `SectionDef` union:

   ```ts
   export type SectionDef =
     | ...existing...
     | { type: "twitch"; channel: string };
   ```

2. **`app/components/Section.tsx`**, add a `case` for the new type:

   ```ts
   case "twitch":
     return <TwitchEmbed channel={def.channel} />;
   ```

3. **Your new component**, write it in `app/components/`, export it, import
   it into `Section.tsx`. Server or client component, your call.

The type system enforces that you provide the right fields in `config/site.ts`.

---

<a id="deploy"></a>
## Deploy

```bash
# Vercel (recommended)
# 1. Push to GitHub.
# 2. Import the repo on vercel.com.
# 3. Paste your .env.local vars into Project Settings → Environment Variables.
# 4. Deploy. The free Hobby tier handles this easily.
```

Any Node-capable host works (Cloudflare Pages, Render, self-hosted, etc.),
nothing platform-specific here.

---

<a id="limitations"></a>
## Known limitations

- **Per-activity clears on deleted characters aren't available.** Bungie's
  `AggregateActivityStats` endpoint (which gives us per-raid / per-dungeon
  counts) only works for active characters. For example, if you cleared Vault of Glass on a character
  you've since deleted, that clear is invisible. The mode-level wildcard
  total *does* include deleted-character clears, via Bungie's
  `mergedDeletedCharacters` bucket.
- **"Flawless" means zero deaths for your character**, not necessarily a
  true team-flawless raid clear. The activity history API gives per-character
  values; team-flawless would require a PGCR lookup per instance.
- **Last.fm "now playing"** is whatever the API returns last, there's a
  small lag (~30s, matching the page cache). A Spotify implementation is currently work in progress, but it's a bit more hacky to set up.
- **Bungie's Cloudflare front occasionally drops new connections** under
  heavy concurrency. The Bungie client retries once on connect-timeout, so
  this should be invisible most of the time.
- **Live activity needs Transitory privacy public.** Bungie has a separate
  privacy switch (bungie.net → Settings → Privacy → "Show profile activity")
  that controls it, set it to "All Users" or the card stays on the
  `PRIVATE` state forever. Stricter privacy on regular stats is fine; this
  is a different setting.
- **Gambit's lifetime W/L and per-match stats are flaky** in Bungie's API.
  The card falls back to computing from the recent match pool when the
  lifetime endpoint returns zeros, but expect some divergence from
  third-party trackers. (Thanks bungie..)
- **speedrun.com embed parameters** are silently ignored on some endpoints.
  The speedrun client falls back to follow-up `/games/{id}` and
  `/categories/{id}` requests so the names + cover art still surface,
  just at the cost of a couple of extra HTTP round-trips per unique
  game / category on first render. Cached for 24h after.

---

## Credits

- [raid.report](https://raid.report/) / [dungeon.report](https://dungeon.report/) for the dot-chart concept and PGCR routing.
- [raidhub](https://raidhub.io) for inspiration behind the activity tracker.
- [Bungie.net API](https://bungie-net.github.io/), [Last.fm API](https://www.last.fm/api), and [speedrun.com API](https://github.com/speedruncomorg/api).
