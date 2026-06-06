const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname),
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
