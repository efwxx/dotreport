"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Layer, OgConfig } from "@/lib/og";
import type { BindingValues } from "@/lib/og-bindings";
import { drawTemplate, prepareRender, type ImageLoader } from "@/lib/og-render";

interface Props {
  config: OgConfig;
  bindings: BindingValues;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onUpdateLayer: (id: string, patch: Partial<Layer>) => void;
}

type DragState =
  | { kind: "none" }
  | {
      kind: "move";
      id: string;
      startX: number;
      startY: number;
      origX: number;
      origY: number;
    }
  | {
      kind: "resize";
      id: string;
      handle: "nw" | "ne" | "sw" | "se";
      startX: number;
      startY: number;
      origX: number;
      origY: number;
      origW: number;
      origH: number;
    };

// Browser image loader: returns an HTMLImageElement once it has loaded. Used
// exclusively by the editor preview - the PNG endpoint has its own napi
// loader.
const browserLoadImage: ImageLoader = (src) =>
  new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    // Anonymous CORS so Bungie / Last.fm images don't taint the canvas. If
    // a host doesn't send CORS headers the image fails here and the editor
    // shows a placeholder; the server-side render still works fine because
    // napi doesn't go through the browser's CORS check.
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

export function OgCanvas({
  config,
  bindings,
  selectedId,
  onSelect,
  onUpdateLayer,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [drag, setDrag] = useState<DragState>({ kind: "none" });

  // Fit the full-resolution canvas inside the wrapper, keeping aspect ratio.
  // We render at the template's true size for crispness and scale via CSS.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const measure = () => {
      const w = wrap.clientWidth;
      if (w === 0) return;
      const s = Math.min(w / config.width, 1);
      setScale(s);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [config.width, config.height]);

  // Redraw whenever the config or bindings change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let cancelled = false;
    (async () => {
      const prepared = await prepareRender(config, bindings, browserLoadImage);
      if (cancelled) return;
      drawTemplate(ctx, prepared);
    })();
    return () => {
      cancelled = true;
    };
  }, [config, bindings]);

  // Convert a mouse event (in CSS pixels relative to the canvas) into canvas
  // coordinates by undoing the display scale.
  const toCanvasCoords = useCallback(
    (e: React.MouseEvent | MouseEvent): { x: number; y: number } => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / scale,
        y: (e.clientY - rect.top) / scale,
      };
    },
    [scale]
  );

  // Top-most layer at the given coords, ignoring hidden + locked.
  const hitTest = useCallback(
    (x: number, y: number): Layer | null => {
      for (let i = config.layers.length - 1; i >= 0; i--) {
        const l = config.layers[i];
        if (l.hidden || l.locked) continue;
        if (x >= l.x && x <= l.x + l.width && y >= l.y && y <= l.y + l.height) {
          return l;
        }
      }
      return null;
    },
    [config.layers]
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      const { x, y } = toCanvasCoords(e);
      const hit = hitTest(x, y);
      if (!hit) {
        onSelect(null);
        return;
      }
      onSelect(hit.id);
      setDrag({
        kind: "move",
        id: hit.id,
        startX: x,
        startY: y,
        origX: hit.x,
        origY: hit.y,
      });
    },
    [hitTest, onSelect, toCanvasCoords]
  );

  // Window-level move/up so a drag continues even if the cursor leaves the
  // canvas. Listeners are scoped to the drag's lifetime.
  useEffect(() => {
    if (drag.kind === "none") return;
    const onMove = (e: MouseEvent) => {
      const { x, y } = toCanvasCoords(e);
      if (drag.kind === "move") {
        onUpdateLayer(drag.id, {
          x: Math.round(drag.origX + (x - drag.startX)),
          y: Math.round(drag.origY + (y - drag.startY)),
        });
      } else if (drag.kind === "resize") {
        const dx = x - drag.startX;
        const dy = y - drag.startY;
        let nx = drag.origX;
        let ny = drag.origY;
        let nw = drag.origW;
        let nh = drag.origH;
        if (drag.handle === "se") {
          nw = drag.origW + dx;
          nh = drag.origH + dy;
        } else if (drag.handle === "ne") {
          nw = drag.origW + dx;
          ny = drag.origY + dy;
          nh = drag.origH - dy;
        } else if (drag.handle === "sw") {
          nx = drag.origX + dx;
          nw = drag.origW - dx;
          nh = drag.origH + dy;
        } else if (drag.handle === "nw") {
          nx = drag.origX + dx;
          ny = drag.origY + dy;
          nw = drag.origW - dx;
          nh = drag.origH - dy;
        }
        // Floor at 8px so the layer stays grabbable; user can still type
        // smaller values in the properties panel.
        if (nw < 8) nw = 8;
        if (nh < 8) nh = 8;
        onUpdateLayer(drag.id, {
          x: Math.round(nx),
          y: Math.round(ny),
          width: Math.round(nw),
          height: Math.round(nh),
        });
      }
    };
    const onUp = () => setDrag({ kind: "none" });
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, toCanvasCoords, onUpdateLayer]);

  const selected = useMemo(
    () => config.layers.find((l) => l.id === selectedId) ?? null,
    [config.layers, selectedId]
  );

  const startResize = (handle: "nw" | "ne" | "sw" | "se") =>
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!selected) return;
      const { x, y } = toCanvasCoords(e);
      setDrag({
        kind: "resize",
        id: selected.id,
        handle,
        startX: x,
        startY: y,
        origX: selected.x,
        origY: selected.y,
        origW: selected.width,
        origH: selected.height,
      });
    };

  return (
    <div ref={wrapRef} className="og-canvas-wrap">
      <div
        className="og-canvas-frame"
        style={{
          width: config.width * scale,
          height: config.height * scale,
        }}
      >
        <canvas
          ref={canvasRef}
          width={config.width}
          height={config.height}
          className="og-canvas"
          style={{
            width: config.width * scale,
            height: config.height * scale,
          }}
          onMouseDown={onMouseDown}
        />
        {selected && !selected.hidden && !selected.locked ? (
          <div
            className="og-selection"
            style={{
              left: selected.x * scale,
              top: selected.y * scale,
              width: selected.width * scale,
              height: selected.height * scale,
            }}
          >
            <div
              className="og-handle og-handle-nw"
              onMouseDown={startResize("nw")}
            />
            <div
              className="og-handle og-handle-ne"
              onMouseDown={startResize("ne")}
            />
            <div
              className="og-handle og-handle-sw"
              onMouseDown={startResize("sw")}
            />
            <div
              className="og-handle og-handle-se"
              onMouseDown={startResize("se")}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
