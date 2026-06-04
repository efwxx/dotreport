"use client";

import { useEffect, useState } from "react";

// Ticking elapsed-time display for the live activity card. Re-renders once
// per second, lives in its own client component so the bulk of the live
// activity card stays server-rendered.
//
// Hydration note: the initial render returns a stable placeholder so the
// server-rendered HTML matches the first client paint exactly. The real
// elapsed value is populated by useEffect on mount, sidestepping the
// "server text didn't match the client" warning that Date.now() during SSR
// would otherwise produce.
type Props = { startTime: string };

export function LiveTimer({ startTime }: Props) {
  const startMs = new Date(startTime).getTime();
  const [elapsed, setElapsed] = useState<number | null>(null);

  useEffect(() => {
    const update = () => {
      setElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startMs]);

  if (elapsed === null) {
    return <>--:--</>;
  }

  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");

  if (h > 0) {
    return <>{`${h}h ${pad(m)}m ${pad(s)}s`}</>;
  }
  return <>{`${m}m ${pad(s)}s`}</>;
}
