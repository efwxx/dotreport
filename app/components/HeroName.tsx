"use client";

import { useEffect, useRef, useState } from "react";
import { copyToClipboard } from "@/lib/clipboard";

// Renders the hero card's name as a click-to-copy button. Used when 2+ hero
// sections exist, so each hero gives its own account's tag straight from the
// name. Outside multi-hero mode, the name renders as plain text and the
// Links section provides the global Join Code pill instead.
type Props = {
  display: string;
  // The actual "Name#Code" tag to copy. Distinct from `display` so display
  // overrides (e.g. just "2B") don't leak into the clipboard.
  tag: string;
};

export function HeroName({ display, tag }: Props) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function handleClick() {
    const ok = await copyToClipboard(tag);
    if (!ok) return;
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`hero-name hero-name-copy${copied ? " is-copied" : ""}`}
      title={`Copy ${tag}`}
      aria-label={`Copy ${tag} to clipboard`}
    >
      {copied ? "Tag copied!" : display}
    </button>
  );
}
