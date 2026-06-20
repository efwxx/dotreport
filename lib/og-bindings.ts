// Resolves OG template data bindings against live account data. The binding
// catalogue itself lives in lib/og-types.ts so client components can import
// it without pulling Bungie/Last.fm code into the browser bundle.

import { resolveAccount, resolveDisplayName } from "@/lib/account";
import {
  cdn,
  CLASS_NAMES,
  findPrimaryMembership,
  getLoadout,
  getProfile,
  resolveEmblemDefinition,
} from "@/lib/bungie";
import { getRecentTrack } from "@/lib/lastfm";
import { BINDINGS } from "@/lib/og-types";

export { BINDINGS, type BindingDef, type BindingKind } from "@/lib/og-types";

export function isImageBinding(key: string): boolean {
  const def = BINDINGS.find((b) => b.key === key);
  return def?.kind === "image";
}

// ---------- Resolution ----------

export type BindingValues = Record<string, string>;

// Resolves every catalogued binding for `accountIndex`. Missing data (e.g. no
// Last.fm key configured, or the character has no kinetic equipped) maps to
// an empty string rather than throwing - layers handle the empty case by
// either drawing a placeholder rectangle (images) or rendering nothing (text).
export async function resolveBindings(
  accountIndex: number
): Promise<BindingValues> {
  const out: BindingValues = {};
  for (const b of BINDINGS) out[b.key] = "";

  const account = resolveAccount(accountIndex);
  if (!account) return out;

  out.displayName = resolveDisplayName(account);
  out.bungieTag = `${account.name}#${String(account.code).padStart(4, "0")}`;

  // Fire the three independent feeds in parallel. Each one swallows its own
  // errors and degrades to empty bindings - we never want a transient Bungie
  // timeout or a missing Last.fm config to fail the whole render.
  const [profileResult, loadoutResult, trackResult] = await Promise.allSettled([
    (async () => {
      const membership = await findPrimaryMembership(account.name, account.code);
      const profile = await getProfile(membership);
      const ch = profile.mostRecentCharacter;
      const def = await resolveEmblemDefinition(ch.emblemHash).catch(
        () => null
      );
      return { membership, character: ch, emblem: def };
    })(),
    (async () => {
      const membership = await findPrimaryMembership(account.name, account.code);
      return await getLoadout(membership);
    })(),
    (async () => {
      try {
        return await getRecentTrack();
      } catch {
        return null;
      }
    })(),
  ]);

  if (profileResult.status === "fulfilled") {
    const { character, emblem } = profileResult.value;
    const className = CLASS_NAMES[character.classType] ?? "Guardian";
    out["character.className"] = className;
    out["character.power"] = String(character.light ?? "");
    out["character.classLight"] = character.light
      ? `${className} · ${character.light}`
      : className;
    out["character.emblemBackgroundUrl"] =
      cdn(emblem?.secondarySpecial) ??
      cdn(character.emblemBackgroundPath) ??
      "";
    out["character.emblemIconUrl"] =
      cdn(emblem?.secondaryOverlay) ?? cdn(character.emblemPath) ?? "";
  }

  if (loadoutResult.status === "fulfilled" && loadoutResult.value) {
    const ld = loadoutResult.value;
    // Map our binding slot names to the loadout's actual fields. `power` ->
    // `power_weapon` because the loadout type avoids the JS reserved-ish
    // shape that double-named keys produce in dictionary access.
    const slotMap: Array<[string, keyof typeof ld]> = [
      ["loadout.kinetic", "kinetic"],
      ["loadout.energy", "energy"],
      ["loadout.power", "power_weapon"],
      ["loadout.exoticArmor", "exoticArmor"],
      ["loadout.subclass", "subclass"],
    ];
    for (const [prefix, field] of slotMap) {
      const slot = ld[field] as
        | { name?: string; icon?: string | null; ornamentIcon?: string | null }
        | undefined;
      if (!slot) continue;
      out[`${prefix}.name`] = slot.name ?? "";
      const iconPath = slot.ornamentIcon ?? slot.icon ?? null;
      out[`${prefix}.iconUrl`] = cdn(iconPath) ?? "";
    }
  }

  if (trackResult.status === "fulfilled" && trackResult.value) {
    const t = trackResult.value;
    out["nowPlaying.title"] = t.name ?? "";
    out["nowPlaying.artist"] = t.artist ?? "";
    out["nowPlaying.album"] = t.album ?? "";
    out["nowPlaying.artUrl"] = t.image ?? "";
  }

  return out;
}
