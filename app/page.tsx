import { sections } from "@/config/site";
import { AutoRefresh } from "./components/AutoRefresh";
import { Section } from "./components/Section";

// Shorter than the previous 60s so each client-side AutoRefresh tick lands
// outside the page cache window, giving Bungie/Last.fm a chance to repull.
export const revalidate = 30;

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
