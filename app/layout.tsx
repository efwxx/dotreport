import type { Metadata } from "next";
import "./globals.css";
import {
  findHeroAccountConfig,
  resolveAccount,
  resolveDisplayName,
} from "@/lib/account";
import {
  cdn,
  findPrimaryMembership,
  getProfile,
  resolveEmblemDefinition,
} from "@/lib/bungie";
import { sections } from "@/config/site";

// Title + favicon both follow whichever account the FIRST `hero` section
// in config/site.ts is configured to display. Defaults to account 1 if no
// hero section exists (or it has no `account` override).
export async function generateMetadata(): Promise<Metadata> {
  const heroCfg = findHeroAccountConfig(sections);
  const account = resolveAccount(heroCfg.account);

  // Compute the tab title even when the account isn't configured, so the
  // page still has a useful title.
  const tabTitle = account
    ? resolveDisplayName(account, heroCfg.displayName)
    : heroCfg.displayName?.trim() || "dotreport";

  // Public origin Discord / Twitter use to resolve the relative og:image URL
  // below. Without this set, Next defaults to http://localhost:3000 and the
  // unfurl crawler has nothing reachable to fetch - the embed shows a title
  // + description but no image.
  //
  // Reads SITE_URL first (server-only, simpler in .env.local) and falls back
  // to NEXT_PUBLIC_SITE_URL so deployments that already set the public
  // variant just work.
  const siteUrl =
    process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const metadataBase = siteUrl ? safeURL(siteUrl) : undefined;

  const base: Metadata = {
    title: tabTitle,
    description: "A Guardian profile + now playing.",
    metadataBase,
    openGraph: {
      title: tabTitle,
      description: "A Guardian profile + now playing.",
      // Live PNG rendered from /og's saved config. The endpoint resolves
      // bindings on every fetch, so the embed always reflects the current
      // emblem / loadout / now-playing.
      images: ["/api/og/image"],
    },
    twitter: {
      card: "summary_large_image",
      title: tabTitle,
      images: ["/api/og/image"],
    },
  };
  if (!account) return base;

  try {
    const membership = await findPrimaryMembership(account.name, account.code);
    const { mostRecentCharacter } = await getProfile(membership);
    const def = await resolveEmblemDefinition(mostRecentCharacter.emblemHash);
    const iconUrl =
      cdn(def?.secondaryOverlay) ?? cdn(mostRecentCharacter.emblemPath);
    if (!iconUrl) return base;
    return {
      ...base,
      icons: {
        icon: iconUrl,
        shortcut: iconUrl,
        apple: iconUrl,
      },
    };
  } catch {
    return base;
  }
}

// new URL() throws on a malformed string; we'd rather log + drop the
// metadataBase than 500 the whole layout.
function safeURL(s: string): URL | undefined {
  try {
    return new URL(s);
  } catch {
    // eslint-disable-next-line no-console
    console.warn(`[layout] SITE_URL is not a valid URL: ${s}`);
    return undefined;
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
