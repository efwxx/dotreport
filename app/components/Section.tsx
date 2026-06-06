import { Suspense } from "react";
import type { SectionDef } from "@/lib/sections";
import { Activities } from "./Activities";
import { Clan } from "./Clan";
import { Hero } from "./Hero";
import { Links } from "./Links";
import { LiveActivity } from "./LiveActivity";
import { Loadout } from "./Loadout";
import { NowPlaying } from "./NowPlaying";
import { Projects } from "./Projects";
import { PvpActivities } from "./PvpActivities";
import { Speedrun } from "./Speedrun";

// Central section router. Every entry in config/site.ts passes through here,
// including the children of `row`. Each branch wraps its async widget in its
// own Suspense boundary so a slow Bungie call doesn't block unrelated
// sections from streaming in.
export function Section({ def }: { def: SectionDef }) {
  switch (def.type) {
    case "hero":
      return (
        <Suspense fallback={<div className="skeleton">Loading guardian...</div>}>
          <Hero
            accountOverride={def.account}
            displayNameOverride={def.displayName}
          />
        </Suspense>
      );
    case "links":
      return (
        <Suspense fallback={null}>
          <Links />
        </Suspense>
      );
    case "activity":
      return (
        <Suspense fallback={<div className="card skeleton-card">Loading...</div>}>
          <Activities
            nameOverride={def.name}
            modeOverride={def.mode}
            titleOverride={def.title}
            accountOverride={def.account}
          />
        </Suspense>
      );
    case "nowPlaying":
      return (
        <Suspense fallback={<div className="card skeleton-card">Loading...</div>}>
          <NowPlaying />
        </Suspense>
      );
    case "pvp":
      return (
        <Suspense fallback={<div className="card skeleton-card">Loading...</div>}>
          <PvpActivities
            mode={def.mode}
            titleOverride={def.title}
            accountOverride={def.account}
          />
        </Suspense>
      );
    case "speedrun":
      return (
        <Suspense fallback={<div className="card skeleton-card">Loading...</div>}>
          <Speedrun
            username={def.username}
            title={def.title}
            limit={def.limit}
          />
        </Suspense>
      );
    case "clan":
      return (
        <Suspense fallback={<div className="card skeleton-card">Loading...</div>}>
          <Clan accountOverride={def.account} titleOverride={def.title} />
        </Suspense>
      );
    case "loadout":
      return (
        <Suspense fallback={<div className="card skeleton-card">Loading...</div>}>
          <Loadout
            accountOverride={def.account}
            titleOverride={def.title}
            extended={def.extended}
          />
        </Suspense>
      );
    case "liveActivity":
      return (
        <Suspense fallback={<div className="card skeleton-card">Loading...</div>}>
          <LiveActivity
            accountOverride={def.account}
            titleOverride={def.title}
            orbitImage={def.orbitImage}
          />
        </Suspense>
      );
    case "projects":
      return <Projects title={def.title} items={def.items} />;
    case "text":
      return (
        <section className="text-section">
          {def.title && <h2 className="section-title">{def.title}</h2>}
          <div className="card text-card">{def.body}</div>
        </section>
      );
    case "row":
      return (
        <div className="profile-grid">
          {def.columns.map((col, i) => (
            <Section key={i} def={col} />
          ))}
        </div>
      );
  }
}
