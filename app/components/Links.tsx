import {
  countHeroes,
  findHeroAccountConfig,
  formatTag,
  resolveAccount,
} from "@/lib/account";
import { findPrimaryMembership, platformSlug } from "@/lib/bungie";
import { sections } from "@/config/site";
import { CopyPill } from "./CopyPill";

// Whichever account the FIRST hero in config/site.ts displays - that's the
// account whose tag the Join Code copies, and whose Bungie.net + Raid Report
// links the defaults point at. When 2+ heroes exist, each hero owns its own
// click-to-copy name, so we drop the redundant Join Code pill here.
const HERO_COUNT = countHeroes(sections);
const HERO_CFG = findHeroAccountConfig(sections);

// Two "kinds" of pill:
//   - link  - a normal anchor that opens in a new tab.
//   - copy  - a button that copies `value` to the clipboard on click.
type LinkItem = { label: string; href: string };
type CopyItem = { label: string; copy: string; copiedLabel?: string };
type Pill = ({ kind: "link" } & LinkItem) | ({ kind: "copy" } & CopyItem);

const isDiscordLabel = (label: string) =>
  label.trim().toLowerCase() === "discord";

// Read EXTRA_LINK_1..20 from env. Format: "Label|value".
// If the label is "Discord" (case-insensitive), `value` is treated as a
// username to copy to the clipboard instead of a URL to open.
function envExtras(): Pill[] {
  const items: Pill[] = [];
  for (let i = 1; i <= 20; i++) {
    const raw = process.env[`EXTRA_LINK_${i}`];
    if (!raw) continue;
    const idx = raw.indexOf("|");
    if (idx === -1) continue;
    const label = raw.slice(0, idx).trim();
    const value = raw.slice(idx + 1).trim();
    if (!label || !value) continue;
    if (isDiscordLabel(label)) {
      items.push({
        kind: "copy",
        label,
        copy: value,
        copiedLabel: "Username copied!",
      });
    } else {
      items.push({ kind: "link", label, href: value });
    }
  }
  return items;
}

function flagOn(name: string): boolean {
  const v = (process.env[name] ?? "").toLowerCase().trim();
  return v === "1" || v === "true" || v === "yes";
}

export async function Links() {
  const lastfmUser = process.env.LASTFM_USERNAME;
  // Pick the account from the first hero section so all the auto-generated
  // links + the Join Code copy follow whichever guardian the page is
  // centered on. Falls back to account 1 if no hero exists.
  const account = resolveAccount(HERO_CFG.account);
  if (!account) return null;
  const { name, code } = account;
  const isMultiHero = HERO_COUNT >= 2;

  const skipDefaults = flagOn("DISABLE_DEFAULT_LINKS");
  const extras = envExtras();
  const tag = formatTag(account);
  const defaults: Pill[] = [];

  // Join Code is identity, not a third-party link - keep it even when
  // DISABLE_DEFAULT_LINKS is on. (In multi-hero mode each hero's name
  // handles its own copy, so we still suppress it there.)
  if (!isMultiHero) {
    defaults.push({
      kind: "copy",
      label: "Join Code",
      copy: tag,
      copiedLabel: "Tag copied!",
    });
  }

  if (!skipDefaults) {
    try {
      const m = await findPrimaryMembership(name, code);
      const encName = encodeURIComponent(tag);
      const slug = platformSlug(m.membershipType);

      defaults.push({
        kind: "link",
        label: "Raid Report",
        href: `https://raid.report/${slug}/${encName}`,
      });
      if (lastfmUser) {
        defaults.push({
          kind: "link",
          label: "Last.fm",
          href: `https://www.last.fm/user/${encodeURIComponent(lastfmUser)}`,
        });
      }
    } catch {
      // Bungie lookup down - still surface the Last.fm pill if possible.
      if (lastfmUser) {
        defaults.push({
          kind: "link",
          label: "Last.fm",
          href: `https://www.last.fm/user/${encodeURIComponent(lastfmUser)}`,
        });
      }
    }
  }

  const pills = [...defaults, ...extras];
  if (!pills.length) return null;

  return (
    <nav className="links" aria-label="Profile links">
      {pills.map((p, i) =>
        p.kind === "copy" ? (
          <CopyPill
            key={`${i}-${p.label}`}
            label={p.label}
            value={p.copy}
            copiedLabel={p.copiedLabel}
          />
        ) : (
          <a
            key={`${i}-${p.href}`}
            className="link-pill"
            href={p.href}
            target="_blank"
            rel="noreferrer"
          >
            {p.label}
          </a>
        ),
      )}
    </nav>
  );
}
