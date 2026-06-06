// Section definitions for the site layout.
//
// Edit `config/site.ts` to reorder, remove, or add sections. Each section
// renders a self-contained card or group; sections appear vertically in the
// order listed, except for `row` which packs its children into the same
// horizontal grid (2-up on desktop, stacked on mobile).
//
// Adding a new section type:
//   1. Add a variant to `SectionDef` below.
//   2. Add a render case in `app/components/Section.tsx`.
//   3. Use it in `config/site.ts`.

export type ProjectItem = {
  title: string;
  description?: string;
  href?: string;
  // Tech / category tags shown as small pills under the description.
  tags?: string[];
  // Single character / emoji shown to the left of the title.
  icon?: string;
};

export type SectionDef =
  // Big card with the player's emblem background, name, class, and power.
  //   account     — 1 (default) or 2+, referencing BUNGIE_NAME_<n>. The page
  //                 favicon and browser tab title also follow this account.
  //   displayName — override the name rendered on the card (and in the tab
  //                 title). Falls back to DISPLAY_NAME_<n>, then to
  //                 "<name>#<code>".
  | { type: "hero"; account?: number; displayName?: string }
  // Row of pill links (default Bungie/Raid Report/Last.fm + EXTRA_LINK_* env).
  | { type: "links" }
  // Tracked-activity dot strip. All knobs optional — falls back to the
  // TRACKED_ACTIVITY_* env vars when omitted, so multiple activity sections
  // can coexist by overriding inline.
  //
  //   name    — substring matched against the activity's Bungie display name.
  //             Catches every difficulty / reissue. Set to "" or "*" for a
  //             WILDCARD strip that shows the 10 most recent clears of any
  //             activity in the chosen mode (count becomes lifetime total,
  //             deleted characters included).
  //   mode    — "raid" (default) or "dungeon". Auto-detected from the matched
  //             activity when omitted, so usually optional.
  //   title   — card title. Defaults to "Recent <name>" or
  //             "Recent Raids" / "Recent Dungeons" for wildcards.
  //   account — 1 (default) or 2+, referencing the BUNGIE_NAME_<n> /
  //             BUNGIE_CODE_<n> env pair. Lets you pull clears from alt
  //             Bungie accounts into their own card.
  | {
      type: "activity";
      name?: string;
      mode?: "raid" | "dungeon";
      title?: string;
      account?: number;
    }
  // PvP / Gambit match tracker. W/L coloured dot strip + lifetime record.
  //   mode    — "crucible" (default), "trials", "ironBanner", or "gambit".
  //   title   — card title (defaults to the mode's display name).
  //   account — 1 (default) or 2+.
  | {
      type: "pvp";
      mode?: "crucible" | "trials" | "ironBanner" | "gambit";
      title?: string;
      account?: number;
    }
  // speedrun.com personal-best card. Optional.
  //   username — speedrun.com handle. Falls back to SPEEDRUN_USERNAME env.
  //   title    — card title.
  //   limit    — number of PBs to show (defaults to 5).
  | {
      type: "speedrun";
      username?: string;
      title?: string;
      limit?: number;
    }
  // Last.fm now-playing card.
  | { type: "nowPlaying" }
  // Live in-game activity card. Shows current activity, a ticking elapsed
  // timer, and fireteam members (with their equipped emblems) when the
  // player is on. Quietly drops to an "offline" state when they're not.
  // Requires the player's Bungie privacy to expose Transitory data.
  //
  //   account    — 1 (default) or 2+. Same convention as the activity
  //                sections.
  //   title      — card title (defaults to "Live Activity").
  //   orbitImage — URL of the image shown when the player is in orbit /
  //                a social space (defaults to "/orbit.jpg"). Drop a file
  //                at `public/orbit.jpg` to populate it.
  | {
      type: "liveActivity";
      account?: number;
      title?: string;
      orbitImage?: string;
    }
  // Project showcase — list of cards, each clickable if `href` is set.
  | { type: "projects"; title?: string; items: ProjectItem[] }
  // Generic vertical heading + free-form HTML/text. Useful for a quick
  // "about" blurb or attribution paragraph.
  | { type: "text"; title?: string; body: string }
  // Pack 2 sections side-by-side in the responsive 2-column grid.
  | { type: "row"; columns: SectionDef[] };
