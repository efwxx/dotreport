"use client";

import { useRef } from "react";

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
import { BLEND_MODES, FONT_FAMILIES, type BindingDef } from "@/lib/og-types";

interface Props {
  config: OgConfig;
  selected: Layer | null;
  assets: string[];
  bindings: BindingValues;
  bindingDefs: BindingDef[];
  onUpdateConfig: (patch: Partial<OgConfig>) => void;
  onUpdateLayer: (id: string, patch: Partial<Layer>) => void;
  onUpload: (file: File) => Promise<string | null>;
  onReset: () => void | Promise<void>;
}

// Always shows the config section; the layer section only renders when a
// layer is selected.
export function OgProperties({
  config,
  selected,
  assets,
  bindings,
  bindingDefs,
  onUpdateConfig,
  onUpdateLayer,
  onUpload,
  onReset,
}: Props) {
  return (
    <div className="og-properties">
      <ConfigSection
        config={config}
        onUpdateConfig={onUpdateConfig}
        onReset={onReset}
      />
      {selected ? (
        <LayerSection
          layer={selected}
          onUpdate={(patch) => onUpdateLayer(selected.id, patch)}
          assets={assets}
          bindings={bindings}
          bindingDefs={bindingDefs}
          onUpload={onUpload}
        />
      ) : (
        <div className="og-empty-hint">
          select a layer in the layers panel to edit its properties.
        </div>
      )}
    </div>
  );
}

function ConfigSection({
  config,
  onUpdateConfig,
  onReset,
}: {
  config: OgConfig;
  onUpdateConfig: (patch: Partial<OgConfig>) => void;
  onReset: () => void | Promise<void>;
}) {
  return (
    <section className="og-prop-section">
      <header className="og-prop-section-title">embed</header>
      <FieldRow>
        <Field label="account">
          <input
            type="number"
            min={1}
            max={8}
            value={config.account}
            onChange={(e) =>
              onUpdateConfig({ account: Number(e.target.value) || 1 })
            }
          />
        </Field>
        <Field label="width">
          <input
            type="number"
            min={100}
            max={4096}
            value={config.width}
            onChange={(e) =>
              onUpdateConfig({ width: Number(e.target.value) || 1200 })
            }
          />
        </Field>
        <Field label="height">
          <input
            type="number"
            min={100}
            max={4096}
            value={config.height}
            onChange={(e) =>
              onUpdateConfig({ height: Number(e.target.value) || 630 })
            }
          />
        </Field>
      </FieldRow>
      <Field label="background">
        <ColorInput
          value={config.background}
          onChange={(v) => onUpdateConfig({ background: v })}
        />
      </Field>
      <div className="sched-actions">
        <button
          type="button"
          className="link-pill og-reset-pill"
          onClick={() => void onReset()}
          title="replace every layer with the starter layout"
        >
          reset to default
        </button>
      </div>
    </section>
  );
}

function LayerSection({
  layer,
  onUpdate,
  assets,
  bindings,
  bindingDefs,
  onUpload,
}: {
  layer: Layer;
  onUpdate: (patch: Partial<Layer>) => void;
  assets: string[];
  bindings: BindingValues;
  bindingDefs: BindingDef[];
  onUpload: (file: File) => Promise<string | null>;
}) {
  return (
    <>
      <section className="og-prop-section">
        <header className="og-prop-section-title">layer</header>
        <Field label="name">
          <input
            value={layer.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
          />
        </Field>
        <FieldRow>
          <Field label="x">
            <input
              type="number"
              value={layer.x}
              onChange={(e) => onUpdate({ x: Number(e.target.value) || 0 })}
            />
          </Field>
          <Field label="y">
            <input
              type="number"
              value={layer.y}
              onChange={(e) => onUpdate({ y: Number(e.target.value) || 0 })}
            />
          </Field>
        </FieldRow>
        <FieldRow>
          <Field label="width">
            <input
              type="number"
              min={1}
              value={layer.width}
              onChange={(e) =>
                onUpdate({ width: Math.max(1, Number(e.target.value) || 1) })
              }
            />
          </Field>
          <Field label="height">
            <input
              type="number"
              min={1}
              value={layer.height}
              onChange={(e) =>
                onUpdate({ height: Math.max(1, Number(e.target.value) || 1) })
              }
            />
          </Field>
        </FieldRow>
        <Field label={`rotation (${Math.round(layer.rotation)}°)`}>
          <input
            type="range"
            min={-180}
            max={180}
            step={1}
            value={layer.rotation}
            onChange={(e) =>
              onUpdate({ rotation: Number(e.target.value) || 0 })
            }
          />
        </Field>
      </section>

      <section className="og-prop-section">
        <header className="og-prop-section-title">effects</header>
        <Field label={`opacity (${Math.round(layer.opacity * 100)}%)`}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={layer.opacity}
            onChange={(e) => onUpdate({ opacity: Number(e.target.value) })}
          />
        </Field>
        <Field label={`blur (${layer.blur}px)`}>
          <input
            type="range"
            min={0}
            max={80}
            step={1}
            value={layer.blur}
            onChange={(e) => onUpdate({ blur: Number(e.target.value) || 0 })}
          />
        </Field>
        <Field label="blend mode">
          <select
            value={layer.blend}
            onChange={(e) =>
              onUpdate({ blend: e.target.value as Layer["blend"] })
            }
          >
            {BLEND_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </Field>
      </section>

      {layer.type === "image" ? (
        <ImageProps
          layer={layer}
          onUpdate={onUpdate as (patch: Partial<ImageLayer>) => void}
          assets={assets}
          bindings={bindings}
          bindingDefs={bindingDefs}
          onUpload={onUpload}
        />
      ) : null}
      {layer.type === "text" ? (
        <TextProps
          layer={layer}
          onUpdate={onUpdate as (patch: Partial<TextLayer>) => void}
          bindings={bindings}
          bindingDefs={bindingDefs}
        />
      ) : null}
      {layer.type === "shape" ? (
        <ShapeProps
          layer={layer}
          onUpdate={onUpdate as (patch: Partial<ShapeLayer>) => void}
        />
      ) : null}
      {layer.type === "gradient" ? (
        <GradientProps
          layer={layer}
          onUpdate={onUpdate as (patch: Partial<GradientLayer>) => void}
        />
      ) : null}
    </>
  );
}

// ---------- Per-type sections ----------

function ImageProps({
  layer,
  onUpdate,
  assets,
  bindings,
  bindingDefs,
  onUpload,
}: {
  layer: ImageLayer;
  onUpdate: (patch: Partial<ImageLayer>) => void;
  assets: string[];
  bindings: BindingValues;
  bindingDefs: BindingDef[];
  onUpload: (file: File) => Promise<string | null>;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  return (
    <section className="og-prop-section">
      <header className="og-prop-section-title">image</header>
      <SourceField
        label="source"
        source={layer.source}
        onChange={(s) => onUpdate({ source: s })}
        bindings={bindings}
        bindingDefs={bindingDefs.filter((b) => b.kind === "image")}
      />
      <Field label="upload">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const url = await onUpload(f);
            if (url) onUpdate({ source: { kind: "literal", value: url } });
            if (fileRef.current) fileRef.current.value = "";
          }}
        />
      </Field>
      {assets.length > 0 ? (
        <Field label="asset library">
          <div className="og-asset-grid">
            {assets.map((a) => {
              const url = `/api/og/assets/${a}`;
              const active =
                layer.source.kind === "literal" && layer.source.value === url;
              return (
                <button
                  key={a}
                  type="button"
                  className={`og-asset-thumb ${active ? "is-active" : ""}`}
                  onClick={() =>
                    onUpdate({ source: { kind: "literal", value: url } })
                  }
                >
                  <img src={url} alt={a} />
                </button>
              );
            })}
          </div>
        </Field>
      ) : null}
      <Field label="fit">
        <select
          value={layer.fit}
          onChange={(e) =>
            onUpdate({ fit: e.target.value as ImageLayer["fit"] })
          }
        >
          <option value="cover">cover</option>
          <option value="contain">contain</option>
          <option value="fill">fill</option>
        </select>
      </Field>
      <Field label={`corner radius (${layer.cornerRadius}px)`}>
        <input
          type="range"
          min={0}
          max={200}
          step={1}
          value={layer.cornerRadius}
          onChange={(e) =>
            onUpdate({ cornerRadius: Number(e.target.value) || 0 })
          }
        />
      </Field>
      <Field label="tint">
        <ColorInput
          value={layer.tint ?? ""}
          allowEmpty
          onChange={(v) => onUpdate({ tint: v || undefined })}
        />
      </Field>
      <Field label={`tint strength (${Math.round((layer.tintOpacity ?? 0) * 100)}%)`}>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={layer.tintOpacity ?? 0}
          onChange={(e) => onUpdate({ tintOpacity: Number(e.target.value) })}
        />
      </Field>
    </section>
  );
}

function TextProps({
  layer,
  onUpdate,
  bindings,
  bindingDefs,
}: {
  layer: TextLayer;
  onUpdate: (patch: Partial<TextLayer>) => void;
  bindings: BindingValues;
  bindingDefs: BindingDef[];
}) {
  return (
    <section className="og-prop-section">
      <header className="og-prop-section-title">text</header>
      <SourceField
        label="content"
        source={layer.content}
        onChange={(s) => onUpdate({ content: s })}
        bindings={bindings}
        bindingDefs={bindingDefs.filter((b) => b.kind === "string")}
        multiline
      />
      <Field label="font family">
        <FontFamilyPicker
          value={layer.fontFamily}
          onChange={(v) => onUpdate({ fontFamily: v })}
        />
      </Field>
      <FieldRow>
        <Field label="size">
          <input
            type="number"
            min={6}
            max={400}
            value={layer.fontSize}
            onChange={(e) =>
              onUpdate({ fontSize: Number(e.target.value) || 16 })
            }
          />
        </Field>
        <Field label="weight">
          <select
            value={layer.fontWeight}
            onChange={(e) =>
              onUpdate({ fontWeight: Number(e.target.value) || 400 })
            }
          >
            {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </Field>
      </FieldRow>
      <FieldRow>
        <Field label="italic">
          <input
            type="checkbox"
            checked={layer.italic}
            onChange={(e) => onUpdate({ italic: e.target.checked })}
          />
        </Field>
        <Field label="align">
          <select
            value={layer.align}
            onChange={(e) =>
              onUpdate({ align: e.target.value as TextLayer["align"] })
            }
          >
            <option value="left">left</option>
            <option value="center">center</option>
            <option value="right">right</option>
          </select>
        </Field>
      </FieldRow>
      <Field label="color">
        <ColorInput
          value={layer.color}
          onChange={(v) => onUpdate({ color: v })}
        />
      </Field>
      <FieldRow>
        <Field label="line height">
          <input
            type="number"
            step={0.05}
            min={0.5}
            max={4}
            value={layer.lineHeight}
            onChange={(e) =>
              onUpdate({ lineHeight: Number(e.target.value) || 1.2 })
            }
          />
        </Field>
        <Field label="letter spacing">
          <input
            type="number"
            step={0.1}
            value={layer.letterSpacing}
            onChange={(e) =>
              onUpdate({ letterSpacing: Number(e.target.value) || 0 })
            }
          />
        </Field>
      </FieldRow>
      <Field label="max lines">
        <input
          type="number"
          min={1}
          max={20}
          value={layer.maxLines}
          onChange={(e) =>
            onUpdate({ maxLines: Math.max(1, Number(e.target.value) || 1) })
          }
        />
      </Field>
      <header className="og-prop-subhead">drop shadow</header>
      <Field label="color">
        <ColorInput
          value={layer.shadowColor ?? ""}
          allowEmpty
          onChange={(v) => onUpdate({ shadowColor: v || undefined })}
        />
      </Field>
      <FieldRow>
        <Field label="blur">
          <input
            type="number"
            min={0}
            value={layer.shadowBlur ?? 0}
            onChange={(e) =>
              onUpdate({ shadowBlur: Number(e.target.value) || 0 })
            }
          />
        </Field>
        <Field label="dx">
          <input
            type="number"
            value={layer.shadowOffsetX ?? 0}
            onChange={(e) =>
              onUpdate({ shadowOffsetX: Number(e.target.value) || 0 })
            }
          />
        </Field>
        <Field label="dy">
          <input
            type="number"
            value={layer.shadowOffsetY ?? 0}
            onChange={(e) =>
              onUpdate({ shadowOffsetY: Number(e.target.value) || 0 })
            }
          />
        </Field>
      </FieldRow>
    </section>
  );
}

function ShapeProps({
  layer,
  onUpdate,
}: {
  layer: ShapeLayer;
  onUpdate: (patch: Partial<ShapeLayer>) => void;
}) {
  return (
    <section className="og-prop-section">
      <header className="og-prop-section-title">shape</header>
      <Field label="shape">
        <select
          value={layer.shape}
          onChange={(e) =>
            onUpdate({ shape: e.target.value as ShapeLayer["shape"] })
          }
        >
          <option value="rect">rectangle</option>
          <option value="ellipse">ellipse</option>
        </select>
      </Field>
      <Field label="fill">
        <ColorInput
          value={layer.fill}
          onChange={(v) => onUpdate({ fill: v })}
        />
      </Field>
      <Field label="stroke">
        <ColorInput
          value={layer.stroke}
          allowEmpty
          onChange={(v) => onUpdate({ stroke: v })}
        />
      </Field>
      <Field label="stroke width">
        <input
          type="number"
          min={0}
          value={layer.strokeWidth}
          onChange={(e) =>
            onUpdate({ strokeWidth: Number(e.target.value) || 0 })
          }
        />
      </Field>
      {layer.shape === "rect" ? (
        <Field label={`corner radius (${layer.cornerRadius}px)`}>
          <input
            type="range"
            min={0}
            max={200}
            step={1}
            value={layer.cornerRadius}
            onChange={(e) =>
              onUpdate({ cornerRadius: Number(e.target.value) || 0 })
            }
          />
        </Field>
      ) : null}
    </section>
  );
}

function GradientProps({
  layer,
  onUpdate,
}: {
  layer: GradientLayer;
  onUpdate: (patch: Partial<GradientLayer>) => void;
}) {
  const setStop = (i: number, patch: Partial<GradientLayer["stops"][number]>) => {
    onUpdate({
      stops: layer.stops.map((s, idx) =>
        idx === i ? { ...s, ...patch } : s
      ),
    });
  };
  return (
    <section className="og-prop-section">
      <header className="og-prop-section-title">gradient</header>
      <Field label={`angle (${layer.angle}°)`}>
        <input
          type="range"
          min={0}
          max={360}
          step={1}
          value={layer.angle}
          onChange={(e) => onUpdate({ angle: Number(e.target.value) || 0 })}
        />
      </Field>
      <header className="og-prop-subhead">stops</header>
      {layer.stops.map((s, i) => (
        <div key={i} className="og-stop-row">
          <input
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={s.offset}
            onChange={(e) =>
              setStop(i, { offset: Number(e.target.value) || 0 })
            }
          />
          <ColorInput
            value={s.color}
            onChange={(v) => setStop(i, { color: v })}
          />
          <button
            type="button"
            className="og-icon-btn og-icon-danger"
            onClick={() =>
              onUpdate({ stops: layer.stops.filter((_, idx) => idx !== i) })
            }
            disabled={layer.stops.length <= 2}
            title="remove stop"
          >
            ×
          </button>
        </div>
      ))}
      <div className="sched-actions">
        <button
          type="button"
          className="link-pill"
          onClick={() =>
            onUpdate({
              stops: [
                ...layer.stops,
                { offset: 0.5, color: "rgba(255,255,255,0.5)" },
              ],
            })
          }
        >
          + stop
        </button>
      </div>
    </section>
  );
}

// ---------- Bits ----------

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="og-field">
      <span className="og-field-label">{label}</span>
      <span className="og-field-control">{children}</span>
    </label>
  );
}

function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className="og-field-row">{children}</div>;
}

// Dropdown of curated font stacks + a "custom" option that surfaces the raw
// text input. We compare against the saved stack string (not just a label)
// so old templates with hand-written stacks still round-trip correctly.
function FontFamilyPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const matched = FONT_FAMILIES.find((f) => f.stack === value);
  const isCustom = !matched;
  return (
    <span className="og-font-picker">
      <select
        value={matched ? matched.stack : "__custom"}
        onChange={(e) => {
          if (e.target.value === "__custom") {
            // Switching to custom leaves the existing stack in the text input
            // so the user has something to edit, not an empty box.
            return;
          }
          onChange(e.target.value);
        }}
        // Inline-style each option so the dropdown previews the font.
        style={{ fontFamily: value }}
      >
        {FONT_FAMILIES.map((f) => (
          <option key={f.label} value={f.stack} style={{ fontFamily: f.stack }}>
            {f.label}
          </option>
        ))}
        <option value="__custom">Custom…</option>
      </select>
      {isCustom ? (
        <input
          value={value}
          placeholder="font-family stack"
          onChange={(e) => onChange(e.target.value)}
        />
      ) : null}
    </span>
  );
}

// String source picker: either a literal value or a runtime binding from the
// catalogue. Renders a tab toggle + the appropriate input.
function SourceField({
  label,
  source,
  onChange,
  bindings,
  bindingDefs,
  multiline,
}: {
  label: string;
  source: StringSource;
  onChange: (s: StringSource) => void;
  bindings: BindingValues;
  bindingDefs: BindingDef[];
  multiline?: boolean;
}) {
  const isBinding = source.kind === "binding";
  return (
    <div className="og-source-field">
      <div className="og-source-tabs">
        <span className="og-field-label">{label}</span>
        <div className="og-source-tabs-buttons">
          <button
            type="button"
            className={`og-tab ${!isBinding ? "is-active" : ""}`}
            onClick={() =>
              onChange({
                kind: "literal",
                value: isBinding ? bindings[source.value] ?? "" : source.value,
              })
            }
          >
            literal
          </button>
          <button
            type="button"
            className={`og-tab ${isBinding ? "is-active" : ""}`}
            onClick={() =>
              onChange({
                kind: "binding",
                value: isBinding ? source.value : bindingDefs[0]?.key ?? "",
              })
            }
          >
            binding
          </button>
        </div>
      </div>
      {isBinding ? (
        <>
          <select
            value={source.value}
            onChange={(e) => onChange({ kind: "binding", value: e.target.value })}
          >
            {groupBindings(bindingDefs).map(([group, defs]) => (
              <optgroup key={group} label={group}>
                {defs.map((b) => (
                  <option key={b.key} value={b.key}>
                    {b.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <div className="og-binding-preview">
            {bindings[source.value]
              ? `→ ${truncate(bindings[source.value], 80)}`
              : "→ (no value yet)"}
          </div>
        </>
      ) : multiline ? (
        <textarea
          rows={3}
          value={source.value}
          onChange={(e) => onChange({ kind: "literal", value: e.target.value })}
        />
      ) : (
        <input
          value={source.value}
          onChange={(e) => onChange({ kind: "literal", value: e.target.value })}
        />
      )}
    </div>
  );
}

function groupBindings(defs: BindingDef[]): Array<[string, BindingDef[]]> {
  const map = new Map<string, BindingDef[]>();
  for (const d of defs) {
    const list = map.get(d.group) ?? [];
    list.push(d);
    map.set(d.group, list);
  }
  return [...map.entries()];
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}

// Side-by-side color + text input so users can paste rgba() or pick from the
// native picker. allowEmpty: clearing the text input clears the value (for
// optional fields like tint / stroke).
function ColorInput({
  value,
  onChange,
  allowEmpty,
}: {
  value: string;
  onChange: (v: string) => void;
  allowEmpty?: boolean;
}) {
  // Native color input only understands #rrggbb. We feed it a normalised hex
  // when we can, otherwise fall back to a neutral so it still renders.
  const hexCandidate = /^#[0-9a-f]{6}$/i.test(value) ? value : "#000000";
  return (
    <span className="og-color-input">
      <input
        type="color"
        value={hexCandidate}
        onChange={(e) => onChange(e.target.value)}
      />
      <input
        type="text"
        value={value}
        placeholder={allowEmpty ? "(none)" : "#rrggbb"}
        onChange={(e) => onChange(e.target.value)}
      />
    </span>
  );
}
