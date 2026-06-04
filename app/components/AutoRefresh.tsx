"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Triggers a soft router refresh on an interval so Bungie/Last.fm data
// updates without the user reloading the page. Uses router.refresh() rather
// than a full reload so React state, scroll position, etc. all survive.
//
// Only fires while the tab is visible. Also refreshes immediately when the
// tab regains focus, in case it sat in the background for a while.
//
// The actual data freshness still depends on the per-fetch `revalidate`
// settings in lib/bungie.ts and lib/lastfm.ts. A refresh that lands inside a
// fetch's TTL window returns the cached value; the next refresh after the
// TTL expires re-pulls from upstream.

type Props = {
  intervalSeconds?: number;
};

export function AutoRefresh({ intervalSeconds = 60 }: Props) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };
    const id = setInterval(tick, intervalSeconds * 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router, intervalSeconds]);
  return null;
}
