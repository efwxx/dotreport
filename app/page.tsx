import { sections } from "@/config/site";
import { AutoRefresh } from "./components/AutoRefresh";
import { Section } from "./components/Section";

// Force per-request rendering. ISR with `revalidate` kept serving a baked
// page (and the children handed to <LoadoutModal>) until its window expired,
// so AutoRefresh / router.refresh would tick but the loadout never changed
// without a hard reload. Per-fetch `cacheSeconds` in lib/bungie.ts (15s on
// the profile + loadout + live calls) still throttle Bungie.
export const dynamic = "force-dynamic";

// The page is now just a thin shell over the section config, edit
// config/site.ts to change what appears here. New section types are added in
// lib/sections.ts and routed in app/components/Section.tsx.
export default function Home() {
  return (
    <main className="page">
      {/*
        Polls router.refresh() in the background so freshly-finished raid /
        dungeon clears show up without a manual reload. Only one of these
        should ever be mounted; it lives at the page root so every section
        re-renders together.
      */}
      <AutoRefresh intervalSeconds={45} />
      {sections.map((s, i) => (
        <Section key={i} def={s} />
      ))}

      <footer>
        <a href="https://bungie.net" target="_blank" rel="noreferrer">
          Bungie.net
        </a>
        <span>·</span>
        <a href="https://raid.report" target="_blank" rel="noreferrer">
          Raid Report
        </a>
        <span>·</span>
        <a href="https://last.fm" target="_blank" rel="noreferrer">
          Last.fm
        </a>
      </footer>
    </main>
  );
}
