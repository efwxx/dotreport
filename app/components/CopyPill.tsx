"use client";

import { useEffect, useRef, useState } from "react";
import { copyToClipboard } from "@/lib/clipboard";

// A pill styled like .link-pill but acts as a button: clicking copies `value`
// to the clipboard and briefly swaps the label to a confirmation string.
type Props = {
  label: string;
  value: string;
  // Optional override for the "Copied!" affirmation (e.g. "Tag copied!").
  copiedLabel?: string;
};

export function CopyPill({ label, value, copiedLabel = "Copied!" }: Props) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function handleClick() {
    const ok = await copyToClipboard(value);
    if (!ok) return;
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`link-pill copy-pill${copied ? " is-copied" : ""}`}
      aria-label={`Copy ${label}: ${value}`}
      title={value}
    >
      <span className="copy-pill-label">{copied ? copiedLabel : label}</span>
    </button>
  );
}
