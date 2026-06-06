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
      // No inline overrides — uses TRACKED_ACTIVITY_* env vars from .env.local.
      // To track two activities at once, give one section an inline override:
      //   { type: "activity", name: "King's Fall", title: "King's Fall" }
      // Mode auto-detects from the matched activity, so dungeons "just work".
      // To pull from an alt account, add `account: 2` (configure
      // BUNGIE_NAME_2 / BUNGIE_CODE_2 in .env.local first):
      //   { type: "activity", name: "Vault of Glass", account: 2, title: "VoG (Alt)" }
      { type: "activity", name: "Garden of Salvation", title: "GoS" },
      { type: "nowPlaying" },
      // Optional: a live activity card. Shows current activity + elapsed
      // timer + fireteam when the player is in-game; quietly becomes an
      // offline state otherwise. Requires the account's Bungie transitory
      // privacy to be set to "All Users".
      { type: "liveActivity" },
      { type: "pvp", mode: "gambit", account: 1 },
      // PvP / Gambit tracker. Mode picks the playlist:
      //   "crucible" (default), "trials", "ironBanner", "gambit"
      // { type: "pvp", mode: "trials" },
      // { type: "pvp", mode: "gambit", title: "Recent Gambit" },
      //
      // Speedrun.com personal-bests. Uses SPEEDRUN_USERNAME from .env.local
      // unless you pass `username` inline.
      { type: "speedrun", limit: 5 },
    ],
  },
];
