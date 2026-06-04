import { NextResponse } from "next/server";
import {
  cdn,
  CLASS_NAMES,
  findPrimaryMembership,
  getAggregateActivityClears,
  getProfile,
  getRecentClears,
  MODE_RAID,
  resolveActivityDefinitions,
} from "@/lib/bungie";

export const revalidate = 60;

const RAID_NAME = "Vault of Glass";

export async function GET() {
  try {
    const name = process.env.BUNGIE_NAME;
    const codeStr = process.env.BUNGIE_CODE;
    if (!name || !codeStr) {
      return NextResponse.json(
        { error: "BUNGIE_NAME and BUNGIE_CODE must be set in .env.local" },
        { status: 500 }
      );
    }
    const code = parseInt(codeStr, 10);
    if (Number.isNaN(code)) {
      return NextResponse.json(
        { error: "BUNGIE_CODE must be a number (e.g. 1234)" },
        { status: 500 }
      );
    }

    const membership = await findPrimaryMembership(name, code);
    const { characters, mostRecentCharacter } = await getProfile(membership);

    const [recentRaids, aggregate] = await Promise.all([
      getRecentClears(membership, characters, MODE_RAID, 200),
      getAggregateActivityClears(membership, characters),
    ]);

    const allHashes = new Set<number>([
      ...recentRaids.map((a) => a.referenceHash),
      ...aggregate.keys(),
    ]);
    const defs = await resolveActivityDefinitions([...allHashes]);

    const vogHashes = new Set<number>();
    for (const [hash, def] of defs) {
      if (def.displayProperties.name?.includes(RAID_NAME)) {
        vogHashes.add(hash);
      }
    }

    let total = 0;
    for (const hash of vogHashes) total += aggregate.get(hash) ?? 0;

    const vog = recentRaids
      .filter((a) => vogHashes.has(a.referenceHash))
      .slice(0, 10)
      .map((a) => {
        const fullName =
          defs.get(a.referenceHash)?.displayProperties.name ?? RAID_NAME;
        return {
          instanceId: a.instanceId,
          name: fullName,
          difficulty: /master/i.test(fullName) ? "Master" : "Normal",
          period: a.period,
          durationSeconds: a.durationSeconds,
          durationDisplay: a.durationDisplay,
          pgcr: `https://raid.report/pgcr/${a.instanceId}`,
        };
      });

    return NextResponse.json({
      guardian: {
        name: `${name}#${String(code).padStart(4, "0")}`,
        displayName: membership.displayName,
        emblem: cdn(mostRecentCharacter.emblemPath),
        emblemBackground: cdn(mostRecentCharacter.emblemBackgroundPath),
        className: CLASS_NAMES[mostRecentCharacter.classType] ?? "Guardian",
        light: mostRecentCharacter.light,
      },
      vaultOfGlass: { total, recent: vog },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
