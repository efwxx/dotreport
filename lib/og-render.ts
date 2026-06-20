// Shared OG template renderer. The same render code drives:
//   - the browser editor's live preview (HTMLCanvasElement + HTMLImageElement)
//   - the public PNG endpoint (@napi-rs/canvas + napi Image)
//
// Both contexts implement the same Canvas2D surface; this file is typed
// against the DOM lib's CanvasRenderingContext2D and the server route casts
// its napi ctx at the boundary. By keeping the renderer pure and synchronous
// (image loading happens up-front in `prepareRender`) the two environments
// can never visually disagree, which is the entire point.

import type {
  GradientLayer,
  ImageLayer,
  Layer,
  OgConfig,
  ShapeLayer,
  StringSource,
  TextLayer,
} from "@/lib/og";
import type { BindingValues } from "@/lib/og-bindings";

// Minimal interface for an image that's already finished loading. Both
// HTMLImageElement (browser) and napi-rs's Image satisfy this and both are
// accepted by ctx.drawImage in their respective environments.
export type RenderImage = {
  width: number;
  height: number;
};

export type ImageLoader = (url: string) => Promise<RenderImage | null>;

export type PreparedLayer =
  | (ImageLayer & { _kind: "image"; resolvedSrc: string; image: RenderImage | null })
  | (TextLayer & { _kind: "text"; resolvedText: string })
  | (ShapeLayer & { _kind: "shape" })
  | (GradientLayer & { _kind: "gradient" });

export type Prepared = {
  layers: PreparedLayer[];
  width: number;
  height: number;
  background: string;
};

// Walks the layer tree, resolves every binding/literal string and kicks off
// image loads in parallel. Returns a snapshot the synchronous draw step can
// run against. Hidden layers are dropped here so the draw loop doesn't have
// to know about visibility.
export async function prepareRender(
  template: Pick<OgConfig, "width" | "height" | "background" | "layers">,
  bindings: BindingValues,
  loadImage: ImageLoader
): Promise<Prepared> {
  const visible = template.layers.filter((l) => !l.hidden);

  // Collect all image URLs first so we can load them concurrently. Same URL
  // appearing twice (e.g. emblem reused as bg + accent) only loads once.
  const urls = new Set<string>();
  for (const l of visible) {
    if (l.type === "image") {
      const src = resolveString(l.source, bindings);
      if (src) urls.add(src);
    }
  }
  const imageMap = new Map<string, RenderImage | null>();
  await Promise.all(
    [...urls].map(async (u) => {
      try {
        imageMap.set(u, await loadImage(u));
      } catch {
        imageMap.set(u, null);
      }
    })
  );

  const layers: PreparedLayer[] = visible.map((l) => {
    switch (l.type) {
      case "image": {
        const src = resolveString(l.source, bindings);
        return {
          ...l,
          _kind: "image",
          resolvedSrc: src,
          image: src ? imageMap.get(src) ?? null : null,
        };
      }
      case "text":
        return {
          ...l,
          _kind: "text",
          resolvedText: resolveString(l.content, bindings),
        };
      case "shape":
        return { ...l, _kind: "shape" };
      case "gradient":
        return { ...l, _kind: "gradient" };
    }
  });

  return {
    layers,
    width: template.width,
    height: template.height,
    background: template.background,
  };
}

function resolveString(source: StringSource, bindings: BindingValues): string {
  if (source.kind === "literal") return source.value;
  return bindings[source.value] ?? "";
}

// ---------- Draw ----------

// Loose ctx type. The browser side passes a real CanvasRenderingContext2D;
// the server side passes a napi-rs SKRSContext2D cast to the same shape.
// We only touch methods present on both.
type Ctx = CanvasRenderingContext2D;

export function drawTemplate(ctx: Ctx, prepared: Prepared): void {
  const { width, height, background, layers } = prepared;

  // Solid backdrop so transparent layers don't show through to whatever the
  // canvas was last cleared to.
  ctx.save();
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  for (const layer of layers) {
    ctx.save();
    // Per-layer composite settings. `filter: blur(Npx)` works in both
    // implementations and applies to all subsequent draws inside the
    // save/restore pair. Note that this does NOT blur what's behind the
    // layer - it blurs the layer's own pixels (Canvas2D has no
    // backdrop-filter). For background-blur effects, pre-blur the
    // backdrop layer itself.
    ctx.globalAlpha = layer.opacity;
    ctx.globalCompositeOperation =
      layer.blend as GlobalCompositeOperation;
    if (layer.blur > 0) ctx.filter = `blur(${layer.blur}px)`;

    // Rotate around the layer's center. Done by translating to the centre,
    // rotating, then translating back so the layer-local draw uses (x, y) as
    // the top-left it'd have at rotation 0.
    if (layer.rotation) {
      const cx = layer.x + layer.width / 2;
      const cy = layer.y + layer.height / 2;
      ctx.translate(cx, cy);
      ctx.rotate((layer.rotation * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }

    switch (layer._kind) {
      case "image":
        drawImageLayer(ctx, layer);
        break;
      case "text":
        drawTextLayer(ctx, layer);
        break;
      case "shape":
        drawShapeLayer(ctx, layer);
        break;
      case "gradient":
        drawGradientLayer(ctx, layer, width, height);
        break;
    }
    ctx.restore();
  }
}

function drawImageLayer(
  ctx: Ctx,
  layer: PreparedLayer & { _kind: "image" }
): void {
  const { x, y, width, height, image, cornerRadius, fit } = layer;

  // Always clip to the layer rect (with optional rounded corners) so even a
  // missing-image placeholder respects the user-set bounds.
  ctx.save();
  pathRoundedRect(ctx, x, y, width, height, cornerRadius);
  ctx.clip();

  if (!image) {
    // Subtle placeholder so the editor shows something for unresolved
    // bindings. The server can stamp the same fallback for unsigned-in
    // accounts so the embed isn't a transparent hole.
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fillRect(x, y, width, height);
    ctx.restore();
    return;
  }

  // Source-rect math for the three fit modes.
  let sx = 0;
  let sy = 0;
  let sw = image.width;
  let sh = image.height;
  let dx = x;
  let dy = y;
  let dw = width;
  let dh = height;

  if (fit === "cover") {
    const targetRatio = width / height;
    const sourceRatio = image.width / image.height;
    if (sourceRatio > targetRatio) {
      // image is wider - crop the sides
      sw = image.height * targetRatio;
      sx = (image.width - sw) / 2;
    } else {
      // image is taller - crop top/bottom
      sh = image.width / targetRatio;
      sy = (image.height - sh) / 2;
    }
  } else if (fit === "contain") {
    const targetRatio = width / height;
    const sourceRatio = image.width / image.height;
    if (sourceRatio > targetRatio) {
      // image is wider - letterbox vertically
      dh = width / sourceRatio;
      dy = y + (height - dh) / 2;
    } else {
      dw = height * sourceRatio;
      dx = x + (width - dw) / 2;
    }
  }
  // "fill" stretches edge-to-edge with the defaults above.

  // Cast away the type difference between HTMLImageElement (browser) and
  // napi-rs Image. Both are valid CanvasImageSource at runtime.
  ctx.drawImage(
    image as unknown as CanvasImageSource,
    sx,
    sy,
    sw,
    sh,
    dx,
    dy,
    dw,
    dh
  );

  // Optional tint pass - a multiply rectangle clipped to the same shape.
  // Cheap colour overlays without re-encoding the image.
  if (layer.tint && (layer.tintOpacity ?? 0) > 0) {
    const prev = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = layer.tintOpacity ?? 1;
    ctx.fillStyle = layer.tint;
    ctx.fillRect(x, y, width, height);
    ctx.globalCompositeOperation = prev;
  }

  ctx.restore();
}

function drawShapeLayer(
  ctx: Ctx,
  layer: PreparedLayer & { _kind: "shape" }
): void {
  const { x, y, width, height, shape, fill, stroke, strokeWidth, cornerRadius } =
    layer;
  ctx.beginPath();
  if (shape === "ellipse") {
    ctx.ellipse(
      x + width / 2,
      y + height / 2,
      width / 2,
      height / 2,
      0,
      0,
      Math.PI * 2
    );
  } else {
    pathRoundedRect(ctx, x, y, width, height, cornerRadius);
  }
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke && strokeWidth > 0) {
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function drawGradientLayer(
  ctx: Ctx,
  layer: PreparedLayer & { _kind: "gradient" },
  _w: number,
  _h: number
): void {
  const { x, y, width, height, angle, stops } = layer;
  // Convert angle into a line that spans the layer's rect. 0deg = top -> bottom
  // following CSS convention (well, almost: CSS uses 0 = upward, but we use
  // the more intuitive "0 = top, 90 = right, 180 = bottom" by adding 90 to
  // the trig). Either convention is fine as long as the editor matches.
  const rad = ((angle - 90) * Math.PI) / 180;
  const cx = x + width / 2;
  const cy = y + height / 2;
  const half = Math.sqrt(width * width + height * height) / 2;
  const dx = Math.cos(rad) * half;
  const dy = Math.sin(rad) * half;
  const grad = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
  for (const s of stops) grad.addColorStop(s.offset, s.color);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, width, height);
}

function drawTextLayer(
  ctx: Ctx,
  layer: PreparedLayer & { _kind: "text" }
): void {
  const {
    x,
    y,
    width,
    height,
    resolvedText,
    fontFamily,
    fontSize,
    fontWeight,
    italic,
    color,
    align,
    lineHeight,
    letterSpacing,
    maxLines,
    shadowBlur,
    shadowColor,
    shadowOffsetX,
    shadowOffsetY,
  } = layer;
  if (!resolvedText) return;

  ctx.font = `${italic ? "italic " : ""}${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = color;
  ctx.textBaseline = "top";
  ctx.textAlign = align;
  // Both contexts support this; napi-rs/canvas added it. Browser support is
  // also wide. Safe to set unconditionally - if it's missing the assignment
  // is a no-op rather than a throw.
  try {
    (ctx as unknown as { letterSpacing?: string }).letterSpacing =
      `${letterSpacing}px`;
  } catch {
    // ignore - falls back to default kerning
  }

  if (shadowColor && (shadowBlur ?? 0) >= 0) {
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = shadowBlur ?? 0;
    ctx.shadowOffsetX = shadowOffsetX ?? 0;
    ctx.shadowOffsetY = shadowOffsetY ?? 0;
  }

  // Word-wrap into up to maxLines, ellipsising the last visible line if the
  // wrapped text would overflow.
  const lines = wrapLines(ctx, resolvedText, width, maxLines);
  const drawX =
    align === "center" ? x + width / 2 : align === "right" ? x + width : x;
  const lineStep = fontSize * lineHeight;
  let drawY = y;
  for (const line of lines) {
    if (drawY + lineStep > y + height + 4) break;
    ctx.fillText(line, drawX, drawY);
    drawY += lineStep;
  }
}

function wrapLines(
  ctx: Ctx,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  // Explicit \n breaks lines unconditionally; everything else is word-wrapped
  // greedily into the next line.
  const paragraphs = text.split("\n");
  const out: string[] = [];
  for (const p of paragraphs) {
    if (out.length >= maxLines) break;
    const words = p.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      out.push("");
      continue;
    }
    let current = words[0];
    for (let i = 1; i < words.length; i++) {
      const next = `${current} ${words[i]}`;
      if (ctx.measureText(next).width <= maxWidth) {
        current = next;
      } else {
        out.push(current);
        if (out.length >= maxLines) break;
        current = words[i];
      }
    }
    if (out.length < maxLines) out.push(current);
  }

  // Ellipsis-truncate the last line if we ran out of room mid-sentence.
  if (out.length === maxLines) {
    const joined = paragraphs.join(" ");
    const fits = out.join(" ");
    if (joined.length > fits.length) {
      let last = out[out.length - 1];
      const ellipsis = "…";
      while (
        last.length > 0 &&
        ctx.measureText(last + ellipsis).width > maxWidth
      ) {
        last = last.slice(0, -1);
      }
      out[out.length - 1] = last + ellipsis;
    }
  }

  return out;
}

// Polyfill-style rounded-rect path that works on any ctx, since older napi
// builds + a couple of browsers don't ship ctx.roundRect yet.
function pathRoundedRect(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  if (radius <= 0) {
    ctx.rect(x, y, w, h);
    return;
  }
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// ---------- Convenience entry point ----------

// One-shot: resolve bindings + draw onto the given ctx. Most callers (editor
// preview and PNG route alike) use this directly.
export async function renderTemplate(
  ctx: Ctx,
  template: Pick<OgConfig, "width" | "height" | "background" | "layers">,
  bindings: BindingValues,
  loadImage: ImageLoader
): Promise<void> {
  const prepared = await prepareRender(template, bindings, loadImage);
  drawTemplate(ctx, prepared);
}

// Used by the layer hit-tester in the editor. Returns the top-most non-locked
// layer at the given canvas coords, or null. We intentionally ignore rotation
// here so the bounding box is always axis-aligned - good enough for selection.
export function hitTestLayer(
  layers: Layer[],
  x: number,
  y: number
): Layer | null {
  for (let i = layers.length - 1; i >= 0; i--) {
    const l = layers[i];
    if (l.hidden || l.locked) continue;
    if (
      x >= l.x &&
      x <= l.x + l.width &&
      y >= l.y &&
      y <= l.y + l.height
    ) {
      return l;
    }
  }
  return null;
}
