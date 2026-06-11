const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  // Disable the client-side Router Cache for RSC payloads. Without this,
  // router.refresh() ticks from <AutoRefresh> can be served from the
  // in-memory client cache (default 30s / 5min for dynamic / static routes
  // respectively) and the loadout card keeps showing the previously-fetched
  // weapons until the user hard-reloads.
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 0,
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "www.bungie.net" },
      { protocol: "https", hostname: "lastfm.freetls.fastly.net" },
      // speedrun.com hosts cover art on www.speedrun.com under /static/game/
      { protocol: "https", hostname: "www.speedrun.com" },
    ],
  },
};

module.exports = nextConfig;
