"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  GradientLayer,
  ImageLayer,
  Layer,
  OgConfig,
  ShapeLayer,
  TextLayer,
} from "@/lib/og";
import type { BindingValues } from "@/lib/og-bindings";
import { BINDINGS, clientId, DEFAULT_FONT } from "@/lib/og-types";

import { OgCanvas } from "./OgCanvas";
import { OgLayerPanel } from "./OgLayerPanel";
import { OgProperties } from "./OgProperties";

interface Props {
  initial: OgConfig;
}

// One-shot password gate + editor for the site's OG embed.
//
// Layout matches the rest of the site: dark background, .page-style header,
// .card surfaces for the canvas / layers / properties stacks. No fullscreen
// IDE chrome - the editor lives at /og as one of the site's normal pages.
export function OgEditor({ initial }: Props) {
  const [password, setPassword] = useState<string | null>(null);
  if (password === null) return <PasswordGate onUnlock={setPassword} />;
  return <UnlockedEditor initial={initial} password={password} />;
}

function PasswordGate({ onUnlock }: { onUnlock: (pw: string) => void }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/og/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "wrong password");
        return;
      }
      onUnlock(pw);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <div className="sched-header">
        <Link href="/" className="sched-back">
          ← home
        </Link>
        <h1 className="sched-title">embed editor</h1>
        <p className="sched-note">
          design the custom opengraph image that shows up when someone shares
          this site’s URL on discord, twitter, etc. enter the editor password
          to begin.
        </p>
      </div>
      <form className="sched-card sched-form" onSubmit={submit}>
        <label className="sched-field">
          <span>password</span>
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoComplete="current-password"
            required
            autoFocus
          />
        </label>
        {error ? <div className="sched-error">{error}</div> : null}
        <div className="sched-actions">
          <button type="submit" className="sched-btn" disabled={loading}>
            {loading ? "checking…" : "unlock"}
          </button>
        </div>
      </form>
    </main>
  );
}

function UnlockedEditor({
  initial,
  password,
}: {
  initial: OgConfig;
  password: string;
}) {
  const [config, setConfig] = useState<OgConfig>(initial);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bindings, setBindings] = useState<BindingValues>({});
  const [bindingsLoading, setBindingsLoading] = useState(true);
  const [saveState, setSaveState] = useState<
    "clean" | "dirty" | "saving" | "saved" | "error"
  >("clean");
  const [saveError, setSaveError] = useState<string | null>(null);

  // Fetch resolved bindings whenever the configured account changes; the
  // values feed both the canvas preview and the binding picker's hover hints.
  useEffect(() => {
    let cancelled = false;
    setBindingsLoading(true);
    fetch(`/api/og/bindings?account=${config.account}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((data: { values: BindingValues }) => {
        if (cancelled) return;
        setBindings(data.values ?? {});
      })
      .catch(() => {
        if (!cancelled) setBindings({});
      })
      .finally(() => {
        if (!cancelled) setBindingsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [config.account]);

  // ---------- Save (debounced) ----------
  const saveRef = useRef<number | null>(null);
  const pendingRef = useRef<OgConfig>(config);
  pendingRef.current = config;

  const flushSave = useCallback(async () => {
    setSaveState("saving");
    try {
      const res = await fetch(`/api/og/config`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-og-password": password,
        },
        body: JSON.stringify({
          account: pendingRef.current.account,
          width: pendingRef.current.width,
          height: pendingRef.current.height,
          background: pendingRef.current.background,
          layers: pendingRef.current.layers,
          assets: pendingRef.current.assets,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(data?.error ?? `save failed (${res.status})`);
        setSaveState("error");
        return;
      }
      setSaveError(null);
      setSaveState("saved");
    } catch (err) {
      setSaveError((err as Error).message);
      setSaveState("error");
    }
  }, [password]);

  // Mark config dirty + schedule a save 600ms after the latest edit. Any
  // further edit resets the timer so we don't fire mid-keystroke.
  const update = useCallback(
    (updater: (prev: OgConfig) => OgConfig) => {
      setConfig((prev) => updater(prev));
      setSaveState("dirty");
      if (saveRef.current !== null) window.clearTimeout(saveRef.current);
      saveRef.current = window.setTimeout(() => {
        saveRef.current = null;
        void flushSave();
      }, 600);
    },
    [flushSave]
  );

  useEffect(() => {
    return () => {
      if (saveRef.current !== null) window.clearTimeout(saveRef.current);
    };
  }, []);

  // ---------- Layer ops ----------

  const updateLayer = useCallback(
    (id: string, patch: Partial<Layer>) => {
      update((prev) => ({
        ...prev,
        layers: prev.layers.map((l) =>
          l.id === id ? ({ ...l, ...patch } as Layer) : l
        ),
      }));
    },
    [update]
  );

  const removeLayer = useCallback(
    (id: string) => {
      update((prev) => ({
        ...prev,
        layers: prev.layers.filter((l) => l.id !== id),
      }));
      setSelectedId((prevSel) => (prevSel === id ? null : prevSel));
    },
    [update]
  );

  const reorderLayer = useCallback(
    (id: string, direction: "up" | "down") => {
      update((prev) => {
        const idx = prev.layers.findIndex((l) => l.id === id);
        if (idx === -1) return prev;
        const targetIdx = direction === "up" ? idx + 1 : idx - 1;
        if (targetIdx < 0 || targetIdx >= prev.layers.length) return prev;
        const next = [...prev.layers];
        const [moved] = next.splice(idx, 1);
        next.splice(targetIdx, 0, moved);
        return { ...prev, layers: next };
      });
    },
    [update]
  );

  const addLayer = useCallback(
    (kind: Layer["type"]) => {
      const id = clientId();
      const base = {
        id,
        x: config.width / 2 - 200,
        y: config.height / 2 - 60,
        width: 400,
        height: 120,
        rotation: 0,
        opacity: 1,
        blur: 0,
        blend: "normal" as const,
        hidden: false,
        locked: false,
      };
      let layer: Layer;
      switch (kind) {
        case "image":
          layer = {
            ...base,
            name: "Image",
            type: "image",
            source: { kind: "literal", value: "" },
            fit: "cover",
            cornerRadius: 0,
          } satisfies ImageLayer;
          break;
        case "text":
          layer = {
            ...base,
            name: "Text",
            type: "text",
            content: { kind: "literal", value: "Sample text" },
            fontFamily: DEFAULT_FONT,
            fontSize: 48,
            fontWeight: 600,
            italic: false,
            color: "#ffffff",
            align: "left",
            lineHeight: 1.2,
            letterSpacing: 0,
            maxLines: 2,
          } satisfies TextLayer;
          break;
        case "shape":
          layer = {
            ...base,
            name: "Shape",
            type: "shape",
            shape: "rect",
            fill: "#ffffff",
            stroke: "",
            strokeWidth: 0,
            cornerRadius: 8,
          } satisfies ShapeLayer;
          break;
        case "gradient":
          layer = {
            ...base,
            x: 0,
            y: 0,
            width: config.width,
            height: config.height,
            name: "Gradient",
            type: "gradient",
            angle: 180,
            stops: [
              { offset: 0, color: "rgba(0,0,0,0)" },
              { offset: 1, color: "rgba(0,0,0,0.85)" },
            ],
          } satisfies GradientLayer;
          break;
      }
      update((prev) => ({ ...prev, layers: [...prev.layers, layer] }));
      setSelectedId(id);
    },
    [config.width, config.height, update]
  );

  const duplicateLayer = useCallback(
    (id: string) => {
      update((prev) => {
        const src = prev.layers.find((l) => l.id === id);
        if (!src) return prev;
        const copy: Layer = {
          ...src,
          id: clientId(),
          name: `${src.name} copy`,
          x: src.x + 20,
          y: src.y + 20,
        };
        return { ...prev, layers: [...prev.layers, copy] };
      });
    },
    [update]
  );

  // ---------- Reset ----------
  // POST /api/og/reset overwrites the saved config with the default layout
  // server-side, so we just mirror the response back into local state and
  // cancel any in-flight debounced save (which would otherwise re-PATCH the
  // stale pre-reset config on top of the fresh one).
  const onReset = useCallback(async () => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "Reset the embed to the default layout? This replaces every layer."
      )
    ) {
      return;
    }
    setSaveState("saving");
    try {
      const res = await fetch(`/api/og/reset`, {
        method: "POST",
        headers: { "x-og-password": password },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(data?.error ?? `reset failed (${res.status})`);
        setSaveState("error");
        return;
      }
      const fresh = (await res.json()) as OgConfig;
      if (saveRef.current !== null) {
        window.clearTimeout(saveRef.current);
        saveRef.current = null;
      }
      setConfig(fresh);
      setSelectedId(null);
      setSaveError(null);
      setSaveState("saved");
    } catch (err) {
      setSaveError((err as Error).message);
      setSaveState("error");
    }
  }, [password]);

  // ---------- Export / import ----------
  //
  // Export bundles the entire editor state - config JSON + base64-encoded
  // copies of every referenced asset - into a single file the user can
  // commit to their repo, paste into chat, etc. Import is the inverse:
  // re-uploads each asset (the server hands back fresh randomly-named
  // filenames so there's no collision with existing assets), then rewrites
  // any layer source URLs that pointed at the OLD asset filename to point at
  // the new one before PATCHing the config.

  const onExport = useCallback(async () => {
    // Collect every asset filename referenced from a literal image source so
    // we don't bake in orphan uploads the user has since switched away from.
    // (data/og/assets can accumulate cruft between sessions.)
    const referenced = new Set<string>();
    for (const l of config.layers) {
      if (l.type !== "image" || l.source.kind !== "literal") continue;
      const m = l.source.value.match(/^\/api\/og\/assets\/(.+)$/);
      if (m) referenced.add(m[1]);
    }

    const assetEntries: Array<{
      filename: string;
      mimeType: string;
      data: string;
    }> = [];
    for (const filename of referenced) {
      try {
        const res = await fetch(`/api/og/assets/${filename}`);
        if (!res.ok) continue;
        const blob = await res.blob();
        const buf = new Uint8Array(await blob.arrayBuffer());
        // Manual base64 (avoids the FileReader dance + we know the input is
        // small-ish since we cap uploads at 15 MB).
        let binary = "";
        for (let i = 0; i < buf.length; i++) {
          binary += String.fromCharCode(buf[i]);
        }
        assetEntries.push({
          filename,
          mimeType: blob.type || "image/png",
          data: btoa(binary),
        });
      } catch {
        // Asset gone from disk; skip it - the import will leave the layer
        // pointing at the (now-missing) URL, which renders as a placeholder
        // rectangle. That matches what the editor already shows.
      }
    }

    const bundle = {
      version: 1,
      exportedAt: new Date().toISOString(),
      config: {
        account: config.account,
        width: config.width,
        height: config.height,
        background: config.background,
        layers: config.layers,
      },
      assets: assetEntries,
    };

    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `og-embed-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [config]);

  const onImport = useCallback(
    async (file: File) => {
      if (
        typeof window !== "undefined" &&
        !window.confirm(
          "Import will replace your current embed. Continue?"
        )
      ) {
        return;
      }
      setSaveState("saving");
      try {
        const text = await file.text();
        const bundle = JSON.parse(text) as {
          version?: number;
          config?: Partial<OgConfig>;
          assets?: Array<{
            filename: string;
            mimeType: string;
            data: string;
          }>;
        };
        if (!bundle.config) {
          throw new Error("missing 'config' in bundle");
        }

        // Re-upload assets first. Server hands back fresh filenames so we
        // don't collide with anything already in data/og/assets/. Build an
        // old→new filename map so we can rewrite the layers.
        const filenameMap = new Map<string, string>();
        for (const a of bundle.assets ?? []) {
          const binary = atob(a.data);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          const form = new FormData();
          form.append("file", new Blob([bytes], { type: a.mimeType }), a.filename);
          const res = await fetch(`/api/og/assets`, {
            method: "POST",
            headers: { "x-og-password": password },
            body: form,
          });
          if (!res.ok) {
            throw new Error(`asset upload failed (${res.status})`);
          }
          const data = (await res.json()) as { filename: string };
          filenameMap.set(a.filename, data.filename);
        }

        // Rewrite any image-layer asset URLs to point at the new filenames.
        const layers = (bundle.config.layers ?? []).map((l) => {
          if (l.type !== "image" || l.source.kind !== "literal") return l;
          const m = l.source.value.match(/^\/api\/og\/assets\/(.+)$/);
          if (!m) return l;
          const remapped = filenameMap.get(m[1]);
          if (!remapped) return l;
          return {
            ...l,
            source: {
              ...l.source,
              value: `/api/og/assets/${remapped}`,
            },
          };
        });

        const patch = {
          account: bundle.config.account,
          width: bundle.config.width,
          height: bundle.config.height,
          background: bundle.config.background,
          layers,
        };

        const res = await fetch(`/api/og/config`, {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
            "x-og-password": password,
          },
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error ?? `import failed (${res.status})`);
        }
        const fresh = (await res.json()) as OgConfig;
        if (saveRef.current !== null) {
          window.clearTimeout(saveRef.current);
          saveRef.current = null;
        }
        setConfig(fresh);
        setSelectedId(null);
        setSaveError(null);
        setSaveState("saved");
      } catch (err) {
        setSaveError((err as Error).message);
        setSaveState("error");
      }
    },
    [password]
  );

  // ---------- Asset uploads ----------

  const onUpload = useCallback(
    async (file: File): Promise<string | null> => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/og/assets`, {
        method: "POST",
        headers: { "x-og-password": password },
        body: form,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSaveError(data?.error ?? `upload failed (${res.status})`);
        setSaveState("error");
        return null;
      }
      const data = (await res.json()) as { filename: string; url: string };
      update((prev) => ({
        ...prev,
        assets: prev.assets.includes(data.filename)
          ? prev.assets
          : [...prev.assets, data.filename],
      }));
      return data.url;
    },
    [password, update]
  );

  const selected = useMemo(
    () => config.layers.find((l) => l.id === selectedId) ?? null,
    [config.layers, selectedId]
  );

  return (
    <main className="page og-page">
      <div className="sched-header">
        <Link href="/" className="sched-back">
          ← home
        </Link>
        <div className="og-page-headline">
          <h1 className="sched-title">embed editor</h1>
          <div className="og-page-headline-meta">
            <SaveBadge state={saveState} error={saveError} />
            <button
              type="button"
              className="link-pill"
              onClick={() => void flushSave()}
              disabled={saveState === "saving"}
            >
              save
            </button>
            <button
              type="button"
              className="link-pill"
              onClick={() => void onExport()}
              title="download a portable JSON of this embed + its assets"
            >
              export
            </button>
            <ImportButton onImport={onImport} />
            <a
              className="link-pill"
              href={`/api/og/image?ts=${Date.now()}`}
              target="_blank"
              rel="noreferrer"
            >
              open PNG
            </a>
          </div>
        </div>
        <p className="sched-note">
          customise the picture that shows up when this site’s URL is shared.
          edits auto-save as you change them; the live PNG endpoint at{" "}
          <code>/api/og/image</code> always serves the current config with
          fresh bindings.
        </p>
      </div>

      <section className="card og-preview-card">
        <header className="card-header">
          <span className="section-title">preview</span>
          {bindingsLoading ? (
            <span className="card-stat-label">resolving bindings…</span>
          ) : null}
        </header>
        <OgCanvas
          config={config}
          bindings={bindings}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onUpdateLayer={updateLayer}
        />
      </section>

      <div className="og-grid">
        <section className="card og-panel-card">
          <header className="card-header">
            <span className="section-title">layers</span>
          </header>
          <OgLayerPanel
            config={config}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onAdd={addLayer}
            onUpdate={updateLayer}
            onRemove={removeLayer}
            onReorder={reorderLayer}
            onDuplicate={duplicateLayer}
          />
        </section>

        <section className="card og-panel-card">
          <header className="card-header">
            <span className="section-title">properties</span>
          </header>
          <OgProperties
            config={config}
            selected={selected}
            assets={config.assets}
            bindings={bindings}
            bindingDefs={BINDINGS}
            onUpdateConfig={(patch) =>
              update((prev) => ({ ...prev, ...patch }))
            }
            onUpdateLayer={updateLayer}
            onUpload={onUpload}
            onReset={onReset}
          />
        </section>
      </div>
    </main>
  );
}

function ImportButton({
  onImport,
}: {
  onImport: (file: File) => void | Promise<void>;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  return (
    <>
      <button
        type="button"
        className="link-pill"
        onClick={() => ref.current?.click()}
        title="replace this embed with an exported JSON bundle"
      >
        import
      </button>
      <input
        ref={ref}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          await onImport(f);
          // Reset so picking the same file twice fires the change event again.
          if (ref.current) ref.current.value = "";
        }}
      />
    </>
  );
}

function SaveBadge({
  state,
  error,
}: {
  state: "clean" | "dirty" | "saving" | "saved" | "error";
  error: string | null;
}) {
  const label =
    state === "saving"
      ? "saving…"
      : state === "saved"
      ? "saved"
      : state === "error"
      ? error ?? "save failed"
      : state === "dirty"
      ? "unsaved"
      : "synced";
  return <span className={`og-save-badge og-save-${state}`}>{label}</span>;
}
