import { envSuffix, resolveAccount } from "@/lib/account";
import {
  cdn,
  findPrimaryMembership,
  getLoadout,
  resolveItemTileOverlays,
  resolveStatDefinition,
  STAT_HASHES,
  STAT_MAX,
  STAT_ORDER,
  type ItemTileOverlays,
  type LoadoutSlot,
  type LoadoutStats,
  type StatKey,
} from "@/lib/bungie";
import { LoadoutModal } from "./LoadoutModal";

type Props = {
  accountOverride?: number;
  titleOverride?: string;
  // Legacy flag for inline-extended rendering. Newer recommendation: leave
  // this off (default) and use the built-in modal trigger instead. When
  // true, the card itself shows every slot inline and the modal trigger
  // is suppressed.
  extended?: boolean;
};

// Compact view (default): three weapons + the equipped exotic armor piece
// + the stat row up top + a "Show full loadout" trigger.
// Extended (inline): every weapon AND armor piece, no modal trigger.
// Modal: opened by the trigger button. Server-renders the full equipment
// list into the LoadoutModal client wrapper.

export async function Loadout({
  accountOverride,
  titleOverride,
  extended = false,
}: Props = {}) {
  const account = resolveAccount(accountOverride);
  if (!account) {
    const idx = accountOverride && accountOverride > 1 ? accountOverride : 1;
    const suffix = envSuffix(idx);
    return (
      <div className="empty">
        Account {idx} not configured. Set <code>BUNGIE_NAME{suffix}</code> and
        <code> BUNGIE_CODE{suffix}</code> in <code>.env.local</code>.
      </div>
    );
  }

  const title = titleOverride?.trim() || "Loadout";

  let loadout;
  try {
    const membership = await findPrimaryMembership(account.name, account.code);
    loadout = await getLoadout(membership);
  } catch {
    loadout = null;
  }

  if (!loadout) {
    return (
      <div className="card loadout-card">
        <div className="card-header">
          <div className="card-title">{title}</div>
        </div>
        <div className="empty">No loadout data available.</div>
      </div>
    );
  }

  // Resolve stat icons via the Bungie manifest. All six hashes are stable;
  // both the lookup and the underlying fetch are cached. The tile overlays
  // (gear tier pips, crafted/enhanced badges) come from the same manifest
  // and are equally cacheable.
  const [statDefs, tileOverlays] = await Promise.all([
    Promise.all(STAT_ORDER.map((key) => resolveStatDefinition(STAT_HASHES[key]))),
    resolveItemTileOverlays(),
  ]);
  const statRow = STAT_ORDER.map((key, i) => {
    const def = statDefs[i];
    return {
      key,
      value: loadout.stats[key],
      icon: cdn(def?.displayProperties?.icon) ?? null,
      name: def?.displayProperties?.name ?? key,
    };
  });

  const weapons: Array<{ slot: LoadoutSlot; label: string }> = [
    loadout.kinetic && { slot: loadout.kinetic, label: "Kinetic" },
    loadout.energy && { slot: loadout.energy, label: "Energy" },
    loadout.power_weapon && { slot: loadout.power_weapon, label: "Power" },
  ].filter(Boolean) as Array<{ slot: LoadoutSlot; label: string }>;

  const armorAll: Array<{ slot: LoadoutSlot; label: string }> = [
    loadout.helmet && { slot: loadout.helmet, label: "Helmet" },
    loadout.gauntlets && { slot: loadout.gauntlets, label: "Gauntlets" },
    loadout.chest && { slot: loadout.chest, label: "Chest" },
    loadout.legs && { slot: loadout.legs, label: "Legs" },
    loadout.classArmor && { slot: loadout.classArmor, label: "Class Item" },
  ].filter(Boolean) as Array<{ slot: LoadoutSlot; label: string }>;

  const subclass: Array<{ slot: LoadoutSlot; label: string }> =
    loadout.subclass ? [{ slot: loadout.subclass, label: "Subclass" }] : [];

  // Compact view: surface only the equipped exotic weapon and exotic armor.
  // Two rows max keeps the card's height in line with its row partner
  // (Personal Bests / Clan are typically ~3-row cards) so the 2-column grid
  // stays visually flush. Non-exotic weapons / armor live in the modal.
  const exoticWeapon = weapons.find((w) => w.slot.isExotic);
  const compactItems: Array<{ slot: LoadoutSlot; label: string }> = [];
  if (exoticWeapon) compactItems.push(exoticWeapon);
  if (loadout.exoticArmor) {
    compactItems.push({ slot: loadout.exoticArmor, label: "Exotic Armor" });
  }

  return (
    <div className="card loadout-card">
      <div className="card-header">
        <div className="card-title">
          {title} <span className="loadout-class">· {loadout.className}</span>
        </div>
        <div className="card-stat">
          <span className="card-stat-value">{loadout.power}</span>
          <span className="card-stat-label">POWER</span>
        </div>
      </div>

      <StatRow row={statRow} />

      {extended ? (
        <>
          {subclass.length > 0 && (
            <>
              <div className="loadout-section-label">Subclass</div>
              <LoadoutSlotList items={subclass} overlays={tileOverlays} showPlugs />
            </>
          )}
          <div className="loadout-section-label">Weapons</div>
          <LoadoutSlotList items={weapons} overlays={tileOverlays} showPlugs />
          <div className="loadout-section-label">Armor</div>
          <LoadoutSlotList items={armorAll} overlays={tileOverlays} showPlugs />
        </>
      ) : (
        <>
          {compactItems.length > 0 && (
            <LoadoutSlotList items={compactItems} overlays={tileOverlays} />
          )}
          <LoadoutModal>
            <FullLoadoutPanel
              title={title}
              className={loadout.className}
              power={loadout.power}
              weapons={weapons}
              armor={armorAll}
              subclass={subclass}
              statRow={statRow}
              overlays={tileOverlays}
            />
          </LoadoutModal>
        </>
      )}
    </div>
  );
}

function StatRow({
  row,
}: {
  row: Array<{
    key: StatKey;
    value: number;
    icon: string | null;
    name: string;
  }>;
}) {
  return (
    <div className="loadout-stat-row" aria-label="Character stats">
      {row.map(({ key, value, icon, name }) => (
        <div
          key={key}
          className="loadout-stat-chip"
          title={`${name}: ${value} / ${STAT_MAX}`}
        >
          {icon ? (
            <span
              className="loadout-stat-icon"
              style={{ backgroundImage: `url(${icon})` }}
              aria-hidden
            />
          ) : (
            <span
              className="loadout-stat-icon empty"
              aria-hidden
            />
          )}
          <span className="loadout-stat-value">{value}</span>
        </div>
      ))}
    </div>
  );
}

// Build the CSS custom-property style for an item icon. `--icon` is what's
// shown by default; `--icon-hover` (only set when an ornament is equipped)
// swaps in the base item art on hover so you can preview the underlying
// weapon/armor model without losing the in-game look.
function iconStyle(
  baseIcon: string | null,
  ornamentIcon?: string | null
): React.CSSProperties | undefined {
  const primary = ornamentIcon || baseIcon;
  if (!primary) return undefined;
  const style: Record<string, string> = {
    ["--icon"]: `url("${primary}")`,
  };
  if (ornamentIcon && baseIcon) {
    style["--icon-hover"] = `url("${baseIcon}")`;
  }
  return style as React.CSSProperties;
}

function LoadoutSlotList({
  items,
  overlays,
  showPlugs = false,
}: {
  items: Array<{ slot: LoadoutSlot; label: string }>;
  overlays: ItemTileOverlays;
  showPlugs?: boolean;
}) {
  return (
    <ul className="loadout-list">
      {items.map((s) => {
        // Composite the tile exactly like the game / DIM: item art at the
        // bottom, then the seasonal watermark, then Bungie's official
        // overlay PNGs (gear-tier pips, the red crafted-corner background
        // strip, and the crafted / enhanced badge) stacked in DOM order.
        const tierOverlay =
          s.slot.gearTier > 0
            ? overlays.gearTierOverlays[s.slot.gearTier - 1] ?? null
            : null;
        const badgeOverlay = s.slot.isCrafted
          ? overlays.craftedOverlay
          : s.slot.isEnhanced
            ? overlays.enhancedOverlay
            : null;
        return (
          <li
            key={s.slot.itemHash}
            className={`loadout-row ${s.slot.isExotic ? "is-exotic" : ""}`}
          >
            <div
              className={[
                "loadout-icon",
                s.slot.isExotic ? "is-exotic" : "",
                s.slot.isMasterworked ? "is-masterworked" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={iconStyle(s.slot.icon, s.slot.ornamentIcon)}
              title={
                s.slot.ornamentIcon ? "Hover to see base icon" : undefined
              }
              aria-hidden
            >
              {s.slot.watermarkIcon && (
                <span
                  className="loadout-icon-layer"
                  style={{ backgroundImage: `url(${s.slot.watermarkIcon})` }}
                />
              )}
              {tierOverlay && (
                <span
                  className="loadout-icon-layer"
                  title={`Gear tier ${s.slot.gearTier}`}
                  style={{ backgroundImage: `url(${tierOverlay})` }}
                />
              )}
              {badgeOverlay && overlays.craftedBackground && (
                <span
                  className="loadout-icon-layer"
                  style={{
                    backgroundImage: `url(${overlays.craftedBackground})`,
                  }}
                />
              )}
              {badgeOverlay && (
                <span
                  className="loadout-icon-layer"
                  title={s.slot.isCrafted ? "Crafted" : "Enhanced"}
                  style={{ backgroundImage: `url(${badgeOverlay})` }}
                />
              )}
            </div>
            <div className="loadout-info">
              <div className="loadout-name" title={s.slot.name}>
                {s.slot.name}
              </div>
              <div className="loadout-sub">
                {s.slot.typeName || s.label}
                {s.slot.isExotic && (
                  <span className="loadout-tier">· Exotic</span>
                )}
              </div>
              {showPlugs && s.slot.plugs.length > 0 && (
                <PerkBar plugs={s.slot.plugs} />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// Tiny inline strip of equipped perks / mods, shown only in the modal. Each
// circle is the plug's manifest icon; enhanced plugs get the gold ring +
// left-arrow indicator that mirrors DIM's enhanced perk visual.
function PerkBar({ plugs }: { plugs: LoadoutSlot["plugs"] }) {
  return (
    <div className="perk-bar" aria-label="Equipped perks">
      {plugs.map((p, i) => (
        <div
          // Combine index with hash because multiple sockets can equip the
          // same plug (most commonly the "no mod equipped" placeholder), and
          // plain plugHash alone collides in that case.
          key={`${i}-${p.plugHash}`}
          className={`perk-icon ${p.isEnhanced ? "is-enhanced" : ""}`}
          title={`${p.name}${p.isEnhanced ? " (Enhanced)" : ""}`}
        >
          {p.icon && (
            <div
              className="perk-icon-image"
              style={{ backgroundImage: `url(${p.icon})` }}
              aria-hidden
            />
          )}
        </div>
      ))}
    </div>
  );
}

// Server-rendered modal contents. Reuses the same row layout as the card so
// the visual language carries over - the modal is just a bigger version of
// the same data instead of a different shape.
function FullLoadoutPanel({
  title,
  className,
  power,
  weapons,
  armor,
  subclass,
  statRow,
  overlays,
}: {
  title: string;
  className: string;
  power: number;
  weapons: Array<{ slot: LoadoutSlot; label: string }>;
  armor: Array<{ slot: LoadoutSlot; label: string }>;
  subclass: Array<{ slot: LoadoutSlot; label: string }>;
  statRow: Array<{
    key: StatKey;
    value: number;
    icon: string | null;
    name: string;
  }>;
  overlays: ItemTileOverlays;
}) {
  return (
    <div className="loadout-modal">
      <div className="loadout-modal-header">
        <div className="loadout-modal-title">
          {title} <span className="loadout-class">· {className}</span>
        </div>
        <div className="card-stat">
          <span className="card-stat-value">{power}</span>
          <span className="card-stat-label">POWER</span>
        </div>
      </div>

      <StatRow row={statRow} />

      {subclass.length > 0 && (
        <>
          <div className="loadout-section-label">Subclass</div>
          <LoadoutSlotList items={subclass} overlays={overlays} showPlugs />
        </>
      )}

      <div className="loadout-section-label">Weapons</div>
      <LoadoutSlotList items={weapons} overlays={overlays} showPlugs />

      <div className="loadout-section-label">Armor</div>
      <LoadoutSlotList items={armor} overlays={overlays} showPlugs />
    </div>
  );
}
