import { envSuffix, resolveAccount } from "@/lib/account";
import {
  cdn,
  findPrimaryMembership,
  getClanInfo,
  resolveClanBanner,
  type ResolvedClanBanner,
} from "@/lib/bungie";

type Props = {
  accountOverride?: number;
  titleOverride?: string;
};

export async function Clan({ accountOverride, titleOverride }: Props = {}) {
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

  const title = titleOverride?.trim() || "Clan";

  let clan;
  let banner: ResolvedClanBanner | null = null;
  try {
    const membership = await findPrimaryMembership(account.name, account.code);
    clan = await getClanInfo(membership);
    if (clan?.bannerData) {
      banner = await resolveClanBanner(clan.bannerData);
    }
  } catch {
    clan = null;
  }

  if (!clan) {
    return (
      <div className="card clan-card">
        <div className="card-header">
          <div className="card-title">{title}</div>
        </div>
        <div className="empty">Not in a clan.</div>
      </div>
    );
  }

  const avatar = cdn(clan.avatarPath);

  return (
    <div className="card clan-card">
      <div className="card-header">
        <div className="card-title">{title}</div>
        <div className="card-stat">
          <span className="card-stat-value">{clan.memberCount}</span>
          <span className="card-stat-label">MEMBERS</span>
        </div>
      </div>

      <a
        className="clan-body"
        href={clan.url}
        target="_blank"
        rel="noreferrer"
      >
        {banner ? (
          <ClanBanner banner={banner} />
        ) : avatar ? (
          <div
            className="clan-avatar"
            style={{ backgroundImage: `url(${avatar})` }}
            aria-hidden
          />
        ) : (
          <div className="clan-avatar" aria-hidden />
        )}
        <div className="clan-info">
          <div className="clan-name" title={clan.name}>
            {clan.name}
          </div>
          {clan.motto && (
            <div className="clan-motto" title={clan.motto}>
              "{clan.motto}"
            </div>
          )}
          <div className="clan-meta">
            <span
              className={`clan-rank rank-${clan.memberType}`}
              title={clan.memberTypeLabel}
            >
              {clan.memberTypeLabel}
            </span>
          </div>
        </div>
      </a>
    </div>
  );
}

// Stacks the four banner layers, each as a mask-coloured div so we can
// faithfully recreate the in-game clan banner from raw manifest assets.
// Empty layers (e.g. when Bungie reissues an asset and the old ID no
// longer resolves) are skipped instead of breaking the composition.
function ClanBanner({ banner }: { banner: ResolvedClanBanner }) {
  const layers = [
    banner.gonfalonBackground,
    banner.gonfalonDetail,
    banner.decalBackground,
    banner.decalForeground,
  ].filter((layer) => layer.imageUrl);
  if (!layers.length) return null;
  return (
    <div className="clan-banner" aria-hidden>
      {layers.map((layer, i) => (
        <div
          key={i}
          className="clan-banner-layer"
          style={{
            backgroundColor: layer.color,
            WebkitMaskImage: `url("${layer.imageUrl}")`,
            maskImage: `url("${layer.imageUrl}")`,
          }}
        />
      ))}
    </div>
  );
}
