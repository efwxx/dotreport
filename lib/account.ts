// Account-resolution helpers. Shared between Hero, Activities, and the
// layout-level metadata (favicon + tab title) so they all read the same
// BUNGIE_NAME_<n> / BUNGIE_CODE_<n> / DISPLAY_NAME_<n> pairs.

import type { SectionDef } from "./sections";

export type ResolvedAccount = { name: string; code: number; index: number };

// Bungie tags are zero-padded to 4 digits in every official display
// (bungie.net, the in-game roster, etc.). We store `code` as a number so the
// API lookup works (Bungie's API takes an int), then format with this helper
// anywhere it's shown to the user or copied to the clipboard. Accounts whose
// numeric code is >= 1000 are unaffected; smaller codes get their leading
// zeros restored - e.g. `Yura#0618` instead of `Yura#618`.
export function formatTag(account: { name: string; code: number }): string {
  return `${account.name}#${String(account.code).padStart(4, "0")}`;
}

export function envSuffix(index: number): string {
  return index > 1 ? `_${index}` : "";
}

// Reads BUNGIE_NAME(_N) + BUNGIE_CODE(_N) for a given 1-based account index.
// Returns null if either is unset or the code isn't a number.
export function resolveAccount(
  accountIdx: number | undefined
): ResolvedAccount | null {
  const index = accountIdx && accountIdx > 1 ? accountIdx : 1;
  const suffix = envSuffix(index);
  const name = process.env[`BUNGIE_NAME${suffix}`]?.trim();
  const codeStr = process.env[`BUNGIE_CODE${suffix}`]?.trim();
  if (!name || !codeStr) return null;
  const code = parseInt(codeStr, 10);
  if (Number.isNaN(code)) return null;
  return { name, code, index };
}

// Display-name precedence:
//   1. Inline `displayName` override.
//   2. DISPLAY_NAME(_N) env var matching the account.
//   3. "<name>#<code>".
export function resolveDisplayName(
  account: ResolvedAccount,
  inline?: string
): string {
  if (inline?.trim()) return inline.trim();
  const envName =
    process.env[`DISPLAY_NAME${envSuffix(account.index)}`]?.trim();
  if (envName) return envName;
  return formatTag(account);
}

// Walks the configured sections looking for the first `hero` entry (also
// descends into `row` children). Returns its account + display-name override
// so the layout's <title> and favicon track whichever account the hero is
// configured to show.
export function findHeroAccountConfig(
  sections: SectionDef[]
): { account?: number; displayName?: string } {
  function search(
    secs: SectionDef[]
  ): { account?: number; displayName?: string } | null {
    for (const s of secs) {
      if (s.type === "hero") {
        return { account: s.account, displayName: s.displayName };
      }
      if (s.type === "row") {
        const r = search(s.columns);
        if (r) return r;
      }
    }
    return null;
  }
  return search(sections) ?? {};
}

// Total number of hero sections in the config (descending into rows).
// 2+ heroes flips the page into "multi-account" mode: the join-code link
// disappears and each hero's name itself becomes the per-account copy
// affordance.
export function countHeroes(sections: SectionDef[]): number {
  let n = 0;
  for (const s of sections) {
    if (s.type === "hero") n++;
    else if (s.type === "row") n += countHeroes(s.columns);
  }
  return n;
}
