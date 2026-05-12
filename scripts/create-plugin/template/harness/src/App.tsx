import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { JSONUIProvider, Renderer, defineRegistry } from '@json-render/react';
import { defineCatalog } from '@json-render/core';
import { schema } from '@json-render/react/schema';
import { createStateStore, type StateStore } from '@json-render/core';
import { components, functions as systemFunctions } from './system';

// Plugin widget-elements bundle. Aliased to ../plugin/widget-elements/dist/index.js
// in vite.config.ts. Loaded lazily so a missing/never-built dist doesn't crash
// the harness — the user just sees a console warning.
type PluginElements = {
  slug?: string;
  functions?: Record<string, (args: Record<string, unknown>) => unknown>;
};
const pluginElementsPromise: Promise<PluginElements> = import(/* @vite-ignore */ '@plugin-elements')
  .then((m: any) => (m.default ?? m) as PluginElements)
  .catch((err) => {
    console.warn('[harness] plugin/widget-elements/dist/index.js not loaded:', err?.message ?? err);
    return {} as PluginElements;
  });

// ── Types ─────────────────────────────────────────────────────────────

interface McpTool {
  name: string;
  description?: string;
  mcp: string;
  inputSchema?: unknown;
}

type Source = { kind: 'self' } | { kind: 'plugin'; slug: string };

interface McpServerSummary {
  name: string;
  source?: Source;
  tools: McpTool[];
  failure?: string;
}

interface DataProvider {
  mcp: string;
  tool: string;
  params?: Record<string, unknown>;
}

interface Widget {
  id?: string;
  title?: string;
  description?: string;
  dataProvider?: DataProvider;
  spec: { root: string; elements: Record<string, any> };
}

interface TemplateRef {
  path: string;
  title: string;
  source?: Source;
  json: string;
}

// ── Catalog ───────────────────────────────────────────────────────────
// Permissive catalog: every component accepts any props. Real type-checking
// happens in MyHub against the production catalog. The harness is a sandbox.

const componentDefs: Record<string, { description: string; props: any; slots?: string[] }> = {};
for (const name of Object.keys(components)) {
  componentDefs[name] = { description: name, props: z.object({}).passthrough(), slots: ['children'] };
}

function buildCatalog(mcpTools: McpTool[]) {
  const actions: Record<string, { description: string; params: any }> = {};
  for (const t of mcpTools) {
    actions[`${t.mcp}.${t.name}`] = {
      description: t.description ?? `Call ${t.mcp}.${t.name}`,
      params: z.object({}).passthrough(),
    };
  }
  return defineCatalog(schema, { components: componentDefs, actions });
}

// ── MCP plumbing ──────────────────────────────────────────────────────

async function fetchMcpServers(): Promise<McpServerSummary[]> {
  const res = await fetch('/api/mcp/tools');
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { servers: McpServerSummary[] };
  return body.servers;
}

async function callMcpTool(mcp: string, tool: string, params: Record<string, unknown>): Promise<unknown> {
  const res = await fetch('/api/mcp/call', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mcp, tool, params }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { ok: boolean; data?: unknown; error?: string };
  if (!body.ok) throw new Error(body.error ?? 'unknown error');
  return body.data;
}

// MCP tool result → flat state writes at /<mcp>/<tool>/<key>.
function resultToWrites(mcp: string, tool: string, data: unknown): Array<[string, unknown]> {
  const base = `/${mcp}/${tool}`;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const out: Array<[string, unknown]> = [[base, data]];
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) out.push([`${base}/${k}`, v]);
    return out;
  }
  return [[base, data]];
}

// ── App ───────────────────────────────────────────────────────────────

const STARTER_KEY = '__harness_starter__';

export function App() {
  const [templates, setTemplates] = useState<TemplateRef[]>([]);
  const [selected, setSelected] = useState<string>(STARTER_KEY);
  const [rawJson, setRawJson] = useState<string>('');
  const [servers, setServers] = useState<McpServerSummary[]>([]);
  const [mcpError, setMcpError] = useState<string | null>(null);

  // Load template list once on mount.
  useEffect(() => {
    fetch('/api/templates')
      .then((r) => r.json())
      .then((b: { templates: TemplateRef[] }) => {
        setTemplates(b.templates);
        if (b.templates.length > 0) {
          setSelected(b.templates[0].path);
          setRawJson(b.templates[0].json);
        } else {
          setRawJson(STARTER_JSON);
        }
      })
      .catch(() => setRawJson(STARTER_JSON));
  }, []);

  const reloadMcp = useCallback(() => {
    setMcpError(null);
    fetchMcpServers()
      .then(setServers)
      .catch((err: Error) => setMcpError(err.message));
  }, []);

  useEffect(() => {
    reloadMcp();
  }, [reloadMcp]);

  function onPickTemplate(path: string) {
    setSelected(path);
    if (path === STARTER_KEY) {
      setRawJson(STARTER_JSON);
      return;
    }
    const t = templates.find((x) => x.path === path);
    if (t) setRawJson(t.json);
  }

  const parsed = useMemo<{ ok: true; widget: Widget } | { ok: false; error: string }>(() => {
    try {
      const j = JSON.parse(rawJson);
      if (!j.spec || !j.spec.root || !j.spec.elements) return { ok: false, error: 'Missing spec.root / spec.elements' };
      return { ok: true, widget: j };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }, [rawJson]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr 1fr', gridTemplateRows: '1fr auto', height: '100vh', minHeight: 0 }}>
      <Sidebar
        templates={templates}
        selected={selected}
        onPick={onPickTemplate}
      />
      <Editor rawJson={rawJson} setRawJson={setRawJson} parseError={parsed.ok ? null : parsed.error} />
      <Preview key={rawJson} widget={parsed.ok ? parsed.widget : null} servers={servers} />
      <McpPanel servers={servers} error={mcpError} onReload={reloadMcp} />
    </div>
  );
}

function Sidebar({ templates, selected, onPick }: { templates: TemplateRef[]; selected: string; onPick: (p: string) => void }) {
  return (
    <aside style={{ borderRight: '1px solid #e5e7eb', background: '#fafafa', overflow: 'auto' }}>
      <div style={{ padding: 12, borderBottom: '1px solid #e5e7eb', fontWeight: 600, fontSize: 13 }}>Widgets</div>
      <button
        onClick={() => onPick(STARTER_KEY)}
        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: selected === STARTER_KEY ? '#eef2ff' : 'transparent', border: 0, borderLeft: selected === STARTER_KEY ? '3px solid #6366f1' : '3px solid transparent', cursor: 'pointer', fontSize: 12 }}
      >
        Starter
      </button>
      {templates.map((t) => {
        const sourceLabel = t.source?.kind === 'plugin' ? t.source.slug : 'this plugin';
        const isSelf = !t.source || t.source.kind === 'self';
        return (
          <button
            key={t.path}
            onClick={() => onPick(t.path)}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', background: selected === t.path ? '#eef2ff' : 'transparent', border: 0, borderLeft: selected === t.path ? '3px solid #6366f1' : '3px solid transparent', cursor: 'pointer', fontSize: 12 }}
          >
            <div style={{ fontWeight: 500 }}>{t.title}</div>
            <div style={{ color: '#6b7280', fontSize: 10, fontFamily: 'ui-monospace, monospace' }}>{t.path}</div>
            <span style={{ display: 'inline-block', marginTop: 4, fontSize: 9, padding: '1px 6px', borderRadius: 999, background: isSelf ? '#dcfce7' : '#dbeafe', color: isSelf ? '#166534' : '#1e40af' }}>{sourceLabel}</span>
          </button>
        );
      })}
    </aside>
  );
}

function Editor({ rawJson, setRawJson, parseError }: { rawJson: string; setRawJson: (s: string) => void; parseError: string | null }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, padding: 12, gap: 8, borderRight: '1px solid #e5e7eb' }}>
      <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>Widget JSON</div>
      <textarea
        value={rawJson}
        onChange={(e) => setRawJson(e.target.value)}
        spellCheck={false}
        style={{ flex: 1, minHeight: 0, resize: 'none', fontSize: 12, padding: 8, border: '1px solid #e5e7eb', borderRadius: 8, outline: 'none' }}
      />
      {parseError && (
        <pre style={{ margin: 0, color: '#991b1b', fontSize: 11, background: '#fee2e2', padding: 8, borderRadius: 6, whiteSpace: 'pre-wrap' }}>{parseError}</pre>
      )}
    </div>
  );
}

function Preview({ widget, servers }: { widget: Widget | null; servers: McpServerSummary[] }) {
  const [pluginFunctions, setPluginFunctions] = useState<Record<string, (a: Record<string, unknown>) => unknown>>({});
  useEffect(() => {
    pluginElementsPromise.then((mod) => {
      const slug = mod.slug;
      const fns = mod.functions ?? {};
      if (!slug) return;
      const namespaced: typeof pluginFunctions = {};
      for (const [k, v] of Object.entries(fns)) namespaced[`${slug}_${k}`] = v as any;
      setPluginFunctions(namespaced);
    });
  }, []);
  const allFunctions = useMemo(() => ({ ...systemFunctions, ...pluginFunctions }), [pluginFunctions]);
  const tools = useMemo(() => servers.flatMap((s) => s.tools), [servers]);
  const catalog = useMemo(() => buildCatalog(tools), [tools]);
  const store = useMemo<StateStore>(() => createStateStore({}), []);

  const handlers = useMemo(() => {
    const map: Record<string, (params: Record<string, unknown>) => Promise<unknown>> = {};
    for (const t of tools) {
      const action = `${t.mcp}.${t.name}`;
      map[action] = async (params) => {
        try {
          const data = await callMcpTool(t.mcp, t.name, params ?? {});
          for (const [path, value] of resultToWrites(t.mcp, t.name, data)) store.set(path, value);
          return data;
        } catch (err) {
          store.set(`/_errors/${action}`, err instanceof Error ? err.message : String(err));
          throw err;
        }
      };
    }
    return map;
  }, [tools, store]);

  const { registry } = useMemo(() => {
    const stubs: Record<string, () => Promise<void>> = {};
    for (const k of Object.keys(handlers)) stubs[k] = async () => {};
    return defineRegistry(catalog as never, { components: components as never, actions: stubs as never });
  }, [catalog, handlers]);

  useEffect(() => {
    if (!widget?.dataProvider) return;
    const { mcp, tool, params } = widget.dataProvider;
    const handler = handlers[`${mcp}.${tool}`];
    if (!handler) return;
    void handler(params ?? {});
  }, [widget, handlers]);

  if (!widget) {
    return <div style={{ padding: 12, color: '#6b7280', fontSize: 12 }}>Fix the JSON to see a preview.</div>;
  }

  return (
    <div style={{ padding: 12, overflow: 'auto', background: '#f6f7f9' }}>
      <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500, marginBottom: 8 }}>Preview {widget.title ? `— ${widget.title}` : ''}</div>
      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', minHeight: 200, padding: 0 }}>
        <JSONUIProvider registry={registry} store={store} handlers={handlers} functions={allFunctions}>
          <Renderer spec={widget.spec as any} registry={registry} />
        </JSONUIProvider>
      </div>
    </div>
  );
}

function McpPanel({ servers, error, onReload }: { servers: McpServerSummary[]; error: string | null; onReload: () => void }) {
  return (
    <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #e5e7eb', background: '#fafafa', padding: 12, maxHeight: 220, overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 12 }}>Connected MCP servers</div>
        <button onClick={onReload} style={{ fontSize: 11, padding: '2px 8px', border: '1px solid #d1d5db', background: 'white', borderRadius: 6, cursor: 'pointer' }}>Reload</button>
        {error ? <span style={{ color: '#991b1b', fontSize: 11 }}>Error: {error}</span> : null}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {servers.length === 0 && !error ? (
          <span style={{ color: '#6b7280', fontSize: 11 }}>No MCP servers running. Check plugin/.mcp.json and the server logs.</span>
        ) : null}
        {servers.map((s) => (
          <details key={s.name} style={{ border: '1px solid #e5e7eb', background: 'white', borderRadius: 8, fontSize: 11, minWidth: 220 }}>
            <summary style={{ cursor: 'pointer', padding: '6px 10px', fontWeight: 500 }}>
              {s.name}
              {s.source?.kind === 'plugin' && (
                <span style={{ marginLeft: 6, fontSize: 9, padding: '1px 6px', borderRadius: 999, background: '#dbeafe', color: '#1e40af' }}>{s.source.slug}</span>
              )}
              {' '}
              {s.failure ? <span style={{ color: '#991b1b' }}>— failed</span> : <span style={{ color: '#6b7280' }}>({s.tools.length} tools)</span>}
            </summary>
            <div style={{ padding: '6px 10px', borderTop: '1px solid #e5e7eb', maxHeight: 200, overflow: 'auto' }}>
              {s.failure ? (
                <div style={{ color: '#991b1b' }}>{s.failure}</div>
              ) : (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {s.tools.map((t) => (
                    <li key={t.name} style={{ fontFamily: 'ui-monospace, monospace', padding: '2px 0' }}>
                      <span>{t.name}</span>
                      {t.description ? <span style={{ color: '#6b7280' }}> — {t.description}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

const STARTER_JSON = JSON.stringify(
  {
    title: 'Starter',
    spec: {
      root: 'card',
      elements: {
        card: { type: 'Card', props: {}, children: ['h', 't'] },
        h: { type: 'Heading', props: { text: 'Hello, harness', level: 'h2' } },
        t: { type: 'Text', props: { text: 'Pick a widget on the left, or paste your own JSON. The MCP panel below shows tools you can call from a dataProvider.' } },
      },
    },
  },
  null,
  2,
);
