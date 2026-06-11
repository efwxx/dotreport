// Debug helper: dump the intrinsic/frame plugs on currently equipped
// weapons so we can see what distinguishes tiered intrinsics from real
// Enhanced intrinsics. Run: node scripts/inspect-intrinsics.mjs
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const KEY = env.BUNGIE_API_KEY;
const NAME = env.BUNGIE_NAME;
const CODE = env.BUNGIE_CODE;
const API = "https://www.bungie.net/Platform";
const H = { "X-API-Key": KEY, "Content-Type": "application/json" };

const WEAPON_BUCKETS = new Set([1498876634, 2465295065, 953998645]);

async function get(path) {
  const r = await fetch(`${API}${path}`, { headers: H });
  const j = await r.json();
  return j.Response;
}

const search = await fetch(
  `${API}/Destiny2/SearchDestinyPlayerByBungieName/-1/`,
  {
    method: "POST",
    headers: H,
    body: JSON.stringify({ displayName: NAME, displayNameCode: Number(CODE) }),
  }
).then((r) => r.json());
const m = search.Response[0];

const prof = await get(
  `/Destiny2/${m.membershipType}/Profile/${m.membershipId}/?components=200,205,300,305`
);

const chars = Object.values(prof.characters.data).sort(
  (a, b) => new Date(b.dateLastPlayed) - new Date(a.dateLastPlayed)
);
const charId = chars[0].characterId;
const items = prof.characterEquipment.data[charId].items.filter((i) =>
  WEAPON_BUCKETS.has(i.bucketHash)
);

for (const item of items) {
  const def = await get(
    `/Destiny2/Manifest/DestinyInventoryItemDefinition/${item.itemHash}/`
  );
  const inst = prof.itemComponents.instances.data[item.itemInstanceId];
  console.log(
    `\n=== ${def.displayProperties.name} | state=${item.state} gearTier=${inst?.gearTier} recipeItemHash=${def.inventory?.recipeItemHash} ===`
  );
  const sockets =
    prof.itemComponents.sockets.data[item.itemInstanceId]?.sockets ?? [];
  for (const s of sockets) {
    if (!s.plugHash) continue;
    const p = await get(
      `/Destiny2/Manifest/DestinyInventoryItemDefinition/${s.plugHash}/`
    );
    const cat = p.plug?.plugCategoryIdentifier ?? "";
    if (!cat.includes("intrinsic") && !cat.includes("frames")) continue;
    console.log({
      name: p.displayProperties?.name,
      typeName: p.itemTypeDisplayName,
      cat,
      traitIds: p.traitIds,
      tierType: p.inventory?.tierType,
      visible: s.isVisible,
    });
  }
}
