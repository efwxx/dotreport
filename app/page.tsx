import { sections } from "@/config/site";
import { Section } from "./components/Section";

export const revalidate = 60;

// The page is now just a thin shell over the section config — edit
// config/site.ts to change what appears here. New section types are added in
// lib/sections.ts and routed in app/components/Section.tsx.
export default function Home() {
  return (
    <main className="page">
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
