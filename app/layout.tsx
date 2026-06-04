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

  const base: Metadata = {
    title: tabTitle,
    description: "A Guardian profile + now playing.",
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
