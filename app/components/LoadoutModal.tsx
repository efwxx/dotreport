"use client";

import { useEffect, useState } from "react";

// Client wrapper around a server-rendered full-loadout panel. The button
// stays visible in the card; clicking it pops the panel as a centered modal
// without re-fetching anything. The full loadout markup is passed in as
// `children`, so the parent server component owns the data.
//
// Closing semantics:
//   - X button
//   - Click outside the panel
//   - Escape key
//   - Body scroll is locked while open

type Props = {
  triggerLabel?: string;
  children: React.ReactNode;
};

export function LoadoutModal({
  triggerLabel = "Show full loadout",
  children,
}: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="loadout-show-full"
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </button>
      {open && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Full loadout"
          onClick={() => setOpen(false)}
        >
          <div
            className="modal-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close"
              aria-label="Close"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
            {children}
          </div>
        </div>
      )}
    </>
  );
}
