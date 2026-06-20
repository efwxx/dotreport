"use client";

import type { Layer, OgConfig } from "@/lib/og";

interface Props {
  config: OgConfig;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (kind: Layer["type"]) => void;
  onUpdate: (id: string, patch: Partial<Layer>) => void;
  onRemove: (id: string) => void;
  onReorder: (id: string, direction: "up" | "down") => void;
  onDuplicate: (id: string) => void;
}

function layerGlyph(type: Layer["type"]): string {
  switch (type) {
    case "image":
      return "▣";
    case "text":
      return "T";
    case "shape":
      return "▢";
    case "gradient":
      return "▦";
  }
}

// Layers render last-drawn last, so the panel reverses them to match the
// visual stacking the user sees on the canvas (top item = top of the panel).
export function OgLayerPanel({
  config,
  selectedId,
  onSelect,
  onAdd,
  onUpdate,
  onRemove,
  onReorder,
  onDuplicate,
}: Props) {
  const reversed = [...config.layers].reverse();
  return (
    <>
      <div className="og-add-row">
        <button
          type="button"
          className="link-pill"
          onClick={() => onAdd("image")}
        >
          + image
        </button>
        <button
          type="button"
          className="link-pill"
          onClick={() => onAdd("text")}
        >
          + text
        </button>
        <button
          type="button"
          className="link-pill"
          onClick={() => onAdd("shape")}
        >
          + shape
        </button>
        <button
          type="button"
          className="link-pill"
          onClick={() => onAdd("gradient")}
        >
          + gradient
        </button>
      </div>
      {reversed.length === 0 ? (
        <div className="og-empty-hint">
          no layers yet — add one above to get started.
        </div>
      ) : (
        <ul className="og-layer-list">
          {reversed.map((l) => (
            <li
              key={l.id}
              className={`og-layer-row ${selectedId === l.id ? "is-selected" : ""}`}
            >
              <button
                type="button"
                className="og-layer-pick"
                onClick={() => onSelect(l.id)}
              >
                <span className="og-layer-glyph">{layerGlyph(l.type)}</span>
                <span className="og-layer-name">{l.name}</span>
              </button>
              <div className="og-layer-controls">
                <button
                  type="button"
                  title={l.hidden ? "show" : "hide"}
                  className="og-icon-btn"
                  onClick={() => onUpdate(l.id, { hidden: !l.hidden })}
                >
                  {l.hidden ? "○" : "●"}
                </button>
                <button
                  type="button"
                  title={l.locked ? "unlock" : "lock"}
                  className="og-icon-btn"
                  onClick={() => onUpdate(l.id, { locked: !l.locked })}
                >
                  {l.locked ? "🔒" : "🔓"}
                </button>
                <button
                  type="button"
                  title="bring forward"
                  className="og-icon-btn"
                  onClick={() => onReorder(l.id, "up")}
                >
                  ▲
                </button>
                <button
                  type="button"
                  title="send backward"
                  className="og-icon-btn"
                  onClick={() => onReorder(l.id, "down")}
                >
                  ▼
                </button>
                <button
                  type="button"
                  title="duplicate"
                  className="og-icon-btn"
                  onClick={() => onDuplicate(l.id)}
                >
                  ⧉
                </button>
                <button
                  type="button"
                  title="delete"
                  className="og-icon-btn og-icon-danger"
                  onClick={() => onRemove(l.id)}
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
