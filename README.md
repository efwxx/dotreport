# dotreport

[![View Example](https://img.shields.io/badge/view_example-docslave.nl-8b5cf6?style=for-the-badge)](https://docslave.nl)

A report-style profile page with live data from the Bungie and
Last.fm APIs. Config-driven layout, multi-account support, dot-chart activity
strips, click-to-copy Bungie tags, dynamic emblem updates (even in the website icon!), and a project showcase.

Built with Next.js. All third-party calls happen on the server, so your API keys never reach the browser. There's no
client-side JavaScript outside the copy buttons.

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
| `links` |, | Row of pill links. Defaults (Join Code / Raid Report / Last.fm) follow the first hero's account. Extras come from `EXTRA_LINK_*` env vars. The Join Code pill disappears in multi-hero mode (each hero has its own click-to-copy name instead). |
| `activity` | `name?`, `mode?`, `title?`, `account?` | Dot-chart strip of 10 most recent clears + lifetime count. `name` is a substring match (catches every difficulty/reissue). `mode` auto-detects from the matched activity, so dungeons "just work". `account` indexes into `BUNGIE_NAME_<n>`. |
| `nowPlaying` |, | Last.fm card showing the currently-playing or most-recent track. Live indicator pulses red when actively scrobbling. |
| `projects` | `title?`, `items[]` | Grid of project cards. Each item: `{ title, description?, href?, tags?, icon? }`. Cards are clickable if `href` is set. |
| `text` | `title?`, `body` | Free-form text card. Useful for an "About" blurb or attribution. |
| `row` | `columns[]` | Two-column wrapper. Stacks to one column under 620px. Children can be any other section type. |

**Wildcard activity mode.** Setting `name: ""` or `name: "*"` (or the env var
to the same) turns an activity section into a "10 most recent raid/dungeon
clears of any kind" card. The CLEARS count becomes lifetime total for that
mode, including clears on deleted characters.

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
to `dungeon.report/pgcr/{id}`.

---

<a id="project-structure"></a>
## Project structure

```
dotreport/
├── .env.example                   # documents every env var
├── .env.local                     # ← YOU CREATE THIS (from .env.example)
├── config/
│   └── site.ts                    # ← THE LAYOUT FILE you edit
├── lib/
│   ├── account.ts                 # account resolution + tag formatting helpers
│   ├── bungie.ts                  # Bungie API client (server-only)
│   ├── clipboard.ts               # client-side copy helper
│   ├── lastfm.ts                  # Last.fm API client (server-only)
│   └── sections.ts                # SectionDef types, add new section kinds here
├── app/
│   ├── layout.tsx                 # <title>, favicon (driven by first hero's account)
│   ├── page.tsx                   # thin shell, renders config/site.ts sections
│   ├── globals.css                # all styling
│   ├── api/
│   │   ├── destiny/route.ts       # /api/destiny, JSON of profile + recent VoG
│   │   └── nowplaying/route.ts    # /api/nowplaying, JSON of current track
│   └── components/
│       ├── Activities.tsx         # activity strip server component
│       ├── ClearsStrip.tsx        # the dot chart itself
│       ├── CopyPill.tsx           # click-to-copy pill (Join Code, Discord)
│       ├── Hero.tsx               # emblem + name card
│       ├── HeroName.tsx           # click-to-copy hero name (multi-hero mode)
│       ├── Links.tsx              # link pill row
│       ├── NowPlaying.tsx         # Last.fm card
│       ├── Projects.tsx           # project showcase
│       └── Section.tsx            # section router, switches on SectionDef.type
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
  counts) only works for active characters. If you cleared VoG on a character
  you've since deleted, that clear is invisible. The mode-level wildcard
  total *does* include deleted-character clears, via Bungie's
  `mergedDeletedCharacters` bucket.
- **"Flawless" means zero deaths for your character**, not necessarily a
  true team-flawless raid clear. The activity history API gives per-character
  values; team-flawless would require a PGCR lookup per instance.
- **Last.fm "now playing"** is whatever the API returns last, there's a
  small lag (~30s, matching the page cache).
- **Bungie's Cloudflare front occasionally drops new connections** under
  heavy concurrency. The Bungie client retries once on connect-timeout, so
  this should be invisible most of the time.

---

## Credits

- [raid.report](https://raid.report/) / [dungeon.report](https://dungeon.report/) for the dot-chart concept and PGCR routing.
- [Bungie.net API](https://bungie-net.github.io/) and [Last.fm API](https://www.last.fm/api).
