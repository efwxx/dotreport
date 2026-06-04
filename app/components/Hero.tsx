import {
  countHeroes,
  formatTag,
  resolveAccount,
  resolveDisplayName,
} from "@/lib/account";
import {
  cdn,
  CLASS_NAMES,
  findPrimaryMembership,
  getProfile,
  resolveEmblemDefinition,
} from "@/lib/bungie";
import { sections } from "@/config/site";
import { HeroName } from "./HeroName";

// Compute once at module load; the config is static.
const HERO_COUNT = countHeroes(sections);

type Props = {
  accountOverride?: number;
  displayNameOverride?: string;
};

export async function Hero({
  accountOverride,
  displayNameOverride,
}: Props = {}) {
  const account = resolveAccount(accountOverride);
  if (!account) {
    const idx = accountOverride && accountOverride > 1 ? accountOverride : 1;
    const suffix = idx > 1 ? `_${idx}` : "";
    return (
      <div className="error">
        Missing <code>BUNGIE_NAME{suffix}</code> /{" "}
        <code>BUNGIE_CODE{suffix}</code> in <code>.env.local</code>.
      </div>
    );
  }
  const { name, code } = account;
  const displayName = resolveDisplayName(account, displayNameOverride);
  const tag = formatTag(account);
  // In multi-hero mode each hero's own name becomes the click-to-copy
  // affordance; otherwise the display name is plain text.
  const isMultiHero = HERO_COUNT >= 2;
  const NameNode = isMultiHero ? (
    <HeroName display={displayName} tag={tag} />
  ) : (
    <div className="hero-name">{displayName}</div>
  );

  try {
    const membership = await findPrimaryMembership(name, code);
    const { mostRecentCharacter } = await getProfile(membership);
    const emblemDef = await resolveEmblemDefinition(
      mostRecentCharacter.emblemHash
    );
    const emblem = cdn(mostRecentCharacter.emblemPath);
    // Prefer the wide cinematic "secondary special" art; fall back to the
    // short banner if the manifest lookup fails.
    const bg =
      cdn(emblemDef?.secondarySpecial) ??
      cdn(mostRecentCharacter.emblemBackgroundPath);
    const className = CLASS_NAMES[mostRecentCharacter.classType] ?? "Guardian";

    return (
      <div className="hero">
        {bg && (
          <div
            className="hero-bg"
            style={{ backgroundImage: `url(${bg})` }}
            aria-hidden
          />
        )}
        <div className="hero-content">
          {emblem && (
            <div
              className="emblem-icon"
              style={{ backgroundImage: `url(${emblem})` }}
              role="img"
              aria-label={`${className} emblem`}
            />
          )}
          <div className="hero-text">
            {NameNode}
            <div className="hero-meta">
              <span>{className}</span>
              <span className="dot" />
              <span>Power {mostRecentCharacter.light}</span>
            </div>
          </div>
        </div>
      </div>
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return (
      <div className="hero">
        <div className="hero-content">
          <div className="hero-text">
            {NameNode}
            <div className="hero-meta error">{msg}</div>
          </div>
        </div>
      </div>
    );
  }
}
