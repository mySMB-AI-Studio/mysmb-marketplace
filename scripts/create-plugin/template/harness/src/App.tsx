import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { z } from 'zod';
import { JSONUIProvider, Renderer, defineRegistry } from '@json-render/react';
import { defineCatalog } from '@json-render/core';
import { schema } from '@json-render/react/schema';
import { createStateStore, type StateStore } from '@json-render/core';
import { components, functions as systemFunctions, Unknown as UnknownComponent } from './system';

// Plugin widget-elements bundles. The backend lists every plugin (self +
// marketplace) that ships dist/index.js, and we dynamic-import each at runtime
// so $computed functions like `xero-accounting_status_tone` resolve. Without
// this, marketplace widgets render with empty/undefined values.
type PluginElements = {
  slug?: string;
  functions?: Record<string, (args: Record<string, unknown>) => unknown>;
  components?: Record<string, React.ComponentType<any>>;
};
type PluginBundle = { slug: string; source: { kind: 'self' } | { kind: 'plugin'; slug: string }; url: string };

async function loadAllPluginElements(): Promise<{ functions: Record<string, (a: any) => unknown>; components: Record<string, React.ComponentType<any>> }> {
  let bundles: PluginBundle[] = [];
  try {
    const res = await fetch('/api/plugin-elements');
    bundles = (await res.json()).bundles ?? [];
  } catch (err) {
    console.warn('[harness] failed to list plugin-elements:', err);
    return { functions: {}, components: {} };
  }
  const functions: Record<string, (a: any) => unknown> = {};
  const components: Record<string, React.ComponentType<any>> = {};
  await Promise.all(
    bundles.map(async (b) => {
      try {
        const mod = (await import(/* @vite-ignore */ b.url)) as any;
        const elements = (mod.default ?? mod) as PluginElements;
        // Each plugin self-reports its slug; fall back to the bundle slug.
        const slug = elements.slug ?? b.slug;
        for (const [k, fn] of Object.entries(elements.functions ?? {})) {
          functions[`${slug}_${k}`] = fn as any;
        }
        for (const [k, comp] of Object.entries(elements.components ?? {})) {
          // Plugin composite components are namespaced too: <slug>_<Name>.
          components[`${slug}_${k}`] = comp as any;
        }
      } catch (err) {
        console.warn(`[harness] failed to load ${b.url}:`, err);
      }
    }),
  );
  return { functions, components };
}

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
  transport?: 'stdio' | 'http' | 'sse';
  hasToken?: boolean;
  hasOAuth?: boolean;
  awaitingAuth?: boolean;
  authRequired?: boolean;
}

interface DataProvider {
  mcp: string;
  tool: string;
  params?: Record<string, unknown>;
}

interface Sizing {
  preferred?: { colSpan: number; rowSpan: number };
  min?: { colSpan: number; rowSpan: number };
  max?: { colSpan: number; rowSpan: number };
}

interface Widget {
  id?: string;
  title?: string;
  description?: string;
  sizing?: Sizing;
  dataProvider?: DataProvider;
  spec: { root: string; elements: Record<string, any> };
}

// Dashboard grid presets — match MyHub's CELL_SIZE=80px / GAP=20px.
const GRID_CELL = 80;
const GRID_GAP = 20;
const sizePx = (cols: number, rows: number) => ({
  width: cols * GRID_CELL + (cols - 1) * GRID_GAP,
  height: rows * GRID_CELL + (rows - 1) * GRID_GAP,
});

// React error boundary so a Renderer crash on a single widget doesn't
// blank the whole page. Resets when its `resetKey` changes (we key it on
// the raw widget JSON so picking a different template clears the error).
class WidgetErrorBoundary extends React.Component<
  { resetKey: string; children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[harness] widget render error:', error, info.componentStack);
  }
  componentDidUpdate(prev: { resetKey: string }) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }
  render() {
    if (this.state.error) {
      return (
        <div className="harness-scroll h-full overflow-auto p-4 bg-destructive/5 border-l-2 border-destructive">
          <div className="text-[11px] font-medium text-destructive uppercase tracking-wide">Widget render error</div>
          <div className="mt-2 text-sm text-foreground font-mono">{this.state.error.message}</div>
          <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
            Likely a missing component or <code className="font-mono">$computed</code> function. See the browser console for the component stack.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
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

function buildCatalog(mcpTools: McpTool[], comps: Record<string, unknown>) {
  const componentDefs: Record<string, { description: string; props: any; slots?: string[] }> = {};
  for (const name of Object.keys(comps)) {
    componentDefs[name] = { description: name, props: z.object({}).passthrough(), slots: ['children'] };
  }
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
type Tab = 'editor' | 'connections';

export function App() {
  const [templates, setTemplates] = useState<TemplateRef[]>([]);
  const [selected, setSelected] = useState<string>(STARTER_KEY);
  const [rawJson, setRawJson] = useState<string>('');
  const [servers, setServers] = useState<McpServerSummary[]>([]);
  const [mcpError, setMcpError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('editor');

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

  useEffect(() => { reloadMcp(); }, [reloadMcp]);

  function onPickTemplate(path: string) {
    setSelected(path);
    if (path === STARTER_KEY) { setRawJson(STARTER_JSON); return; }
    const t = templates.find((x) => x.path === path);
    if (t) setRawJson(t.json);
  }

  const parsed = useMemo<{ ok: true; widget: Widget } | { ok: false; error: string }>(() => {
    try {
      const j = JSON.parse(rawJson);
      if (!j.spec || !j.spec.root || !j.spec.elements) return { ok: false, error: 'Missing spec.root / spec.elements' };
      for (const el of Object.values(j.spec.elements as Record<string, any>)) {
        if (el && typeof el === 'object' && el.props == null) el.props = {};
      }
      return { ok: true, widget: j };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }, [rawJson]);

  const stats = useMemo(() => {
    const total = servers.length;
    const connected = servers.filter((s) => !s.failure && !s.awaitingAuth).length;
    const tools = servers.reduce((n, s) => n + s.tools.length, 0);
    const issues = servers.filter((s) => s.failure || s.awaitingAuth).length;
    return { total, connected, tools, issues, widgets: templates.length };
  }, [servers, templates]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <LeftRail tab={tab} onTab={setTab} stats={stats} />
      <div className="flex flex-1 min-w-0 flex-col">
        <Header tab={tab} stats={stats} onReload={reloadMcp} />
        <main className="flex-1 min-h-0 overflow-hidden">
          {tab === 'editor' ? (
            <div className="grid h-full min-h-0" style={{ gridTemplateColumns: '280px 1fr 1fr' }}>
              <Sidebar templates={templates} selected={selected} onPick={onPickTemplate} />
              <Editor rawJson={rawJson} setRawJson={setRawJson} parseError={parsed.ok ? null : parsed.error} />
              <Preview widget={parsed.ok ? parsed.widget : null} rawJson={rawJson} servers={servers} />
            </div>
          ) : (
            <ConnectionsView servers={servers} error={mcpError} onReload={reloadMcp} />
          )}
        </main>
        {tab === 'editor' && <ConnectionsStrip servers={servers} onOpenTab={() => setTab('connections')} />}
      </div>
    </div>
  );
}

// ── Left rail ─────────────────────────────────────────────────────────

function LeftRail({ tab, onTab, stats }: { tab: Tab; onTab: (t: Tab) => void; stats: { connected: number; total: number; issues: number } }) {
  return (
    <aside className="flex w-[220px] shrink-0 flex-col border-r border-border bg-card">
      <div className="flex items-center gap-2.5 px-4 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <span className="font-bold text-base leading-none">W</span>
        </div>
        <div className="leading-tight">
          <div className="text-sm font-medium">Widget Lab</div>
          <div className="text-[11px] text-muted-foreground">mySMB harness</div>
        </div>
      </div>
      <nav className="flex flex-col gap-0.5 px-2 py-2">
        <RailItem icon="◆" label="Editor" active={tab === 'editor'} onClick={() => onTab('editor')} />
        <RailItem
          icon="⚡"
          label="Connections"
          active={tab === 'connections'}
          onClick={() => onTab('connections')}
          trailing={
            <span
              className={`rounded-full px-1.5 text-[10px] font-medium ${
                stats.issues
                  ? 'bg-warning/15 text-warning'
                  : stats.connected
                  ? 'bg-success/15 text-success'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {stats.connected}/{stats.total}
            </span>
          }
        />
      </nav>
      <div className="mt-auto px-4 pb-4 pt-4">
        <a
          href="https://github.com/mySMB-AI-Studio/mysmb-marketplace"
          target="_blank"
          rel="noreferrer"
          className="text-[11px] text-muted-foreground hover:text-foreground"
        >
          ← Marketplace docs
        </a>
      </div>
    </aside>
  );
}

function RailItem({ icon, label, active, onClick, trailing }: { icon: string; label: string; active: boolean; onClick: () => void; trailing?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`harness-focus flex items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-sm transition-colors ${
        active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
      }`}
    >
      <span className="w-4 text-center text-[13px] opacity-80">{icon}</span>
      <span className="flex-1 truncate">{label}</span>
      {trailing}
    </button>
  );
}

// ── Header ────────────────────────────────────────────────────────────

function Header({ tab, stats, onReload }: { tab: Tab; stats: { connected: number; total: number; issues: number }; onReload: () => void }) {
  const title = tab === 'editor' ? 'Widget Lab' : 'Connections';
  const subtitle =
    tab === 'editor'
      ? 'Pick a template, tweak the JSON, preview at dashboard sizes.'
      : 'Authorize MCP servers and inspect available tools.';
  return (
    <header className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-medium tracking-tight">{title}</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {tab === 'connections' && stats.issues > 0 && (
          <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">
            {stats.issues} blocked
          </span>
        )}
        <button
          onClick={onReload}
          className="harness-focus inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-[13px] hover:bg-muted/50"
        >
          <span aria-hidden>↻</span>
          Reload MCP
        </button>
      </div>
    </header>
  );
}

// ── Connections strip (bottom of Editor view) ─────────────────────────

function ConnectionsStrip({ servers, onOpenTab }: { servers: McpServerSummary[]; onOpenTab: () => void }) {
  const visible = servers.slice(0, 6);
  const extra = Math.max(0, servers.length - visible.length);
  return (
    <div className="shrink-0 border-t border-border bg-card">
      <div className="flex items-center gap-3 overflow-x-auto px-4 py-2 harness-scroll">
        <button
          onClick={onOpenTab}
          className="harness-focus shrink-0 text-[12px] font-medium text-muted-foreground hover:text-foreground"
        >
          ▣ Connected MCP servers →
        </button>
        {visible.map((s) => {
          const state = s.failure ? 'error' : s.awaitingAuth ? 'warn' : 'ok';
          return (
            <button
              key={s.name}
              onClick={onOpenTab}
              className="harness-focus inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-[12px] hover:bg-muted/50"
              title={s.failure ?? `${s.tools.length} tools`}
            >
              <Dot state={state} />
              <span className="font-medium">{s.name}</span>
              <span className="text-muted-foreground">
                {state === 'ok' ? `${s.tools.length} tools` : state === 'warn' ? 'auth' : 'failed'}
              </span>
            </button>
          );
        })}
        {extra > 0 && (
          <button onClick={onOpenTab} className="harness-focus shrink-0 text-[12px] text-muted-foreground hover:text-foreground">
            +{extra} more
          </button>
        )}
      </div>
    </div>
  );
}

function Dot({ state }: { state: 'ok' | 'warn' | 'error' | 'muted' }) {
  const colors: Record<string, string> = {
    ok: 'bg-success',
    warn: 'bg-warning',
    error: 'bg-destructive',
    muted: 'bg-muted-foreground/40',
  };
  return <span className={`inline-block h-1.5 w-1.5 rounded-full ${colors[state]}`} />;
}

function Sidebar({ templates, selected, onPick }: { templates: TemplateRef[]; selected: string; onPick: (p: string) => void }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    if (!query.trim()) return templates;
    const q = query.toLowerCase();
    return templates.filter((t) => t.title.toLowerCase().includes(q) || t.path.toLowerCase().includes(q));
  }, [templates, query]);
  return (
    <aside className="harness-scroll flex h-full min-h-0 flex-col overflow-auto border-r border-border bg-card">
      <div className="sticky top-0 z-10 border-b border-border bg-card px-4 pb-3 pt-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-medium">Templates</h2>
          <span className="text-[11px] text-muted-foreground">{templates.length}</span>
        </div>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search templates…"
          className="harness-focus w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-[12px] outline-none placeholder:text-muted-foreground"
        />
      </div>
      <button
        onClick={() => onPick(STARTER_KEY)}
        className={`harness-focus block w-full px-4 py-2 text-left transition-colors ${
          selected === STARTER_KEY ? 'bg-muted' : 'hover:bg-muted/50'
        }`}
      >
        <div className="text-[13px] font-medium">Starter</div>
        <div className="font-mono text-[10.5px] text-muted-foreground">blank slate</div>
      </button>
      {filtered.map((t) => {
        const isActive = selected === t.path;
        const slug = t.source?.kind === 'plugin' ? t.source.slug : null;
        return (
          <button
            key={t.path}
            onClick={() => onPick(t.path)}
            className={`harness-focus block w-full px-4 py-2 text-left transition-colors ${
              isActive ? 'bg-muted' : 'hover:bg-muted/50'
            }`}
          >
            <div className="truncate text-[13px] font-medium">{t.title}</div>
            <div className="truncate font-mono text-[10.5px] text-muted-foreground">{t.path}</div>
            {slug && (
              <span className="mt-1 inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {slug}
              </span>
            )}
          </button>
        );
      })}
      <div className="h-4 shrink-0" />
    </aside>
  );
}

function Editor({ rawJson, setRawJson, parseError }: { rawJson: string; setRawJson: (s: string) => void; parseError: string | null }) {
  const lines = rawJson.split('\n').length;
  return (
    <div className="flex min-h-0 flex-col border-r border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h2 className="text-[13px] font-medium">Widget JSON</h2>
        <div className="flex items-center gap-3 font-mono text-[10.5px] text-muted-foreground">
          <span>{lines} ln</span>
          <span>{rawJson.length} ch</span>
        </div>
      </div>
      <div className="relative flex flex-1 min-h-0 flex-col p-3">
        <textarea
          value={rawJson}
          onChange={(e) => setRawJson(e.target.value)}
          spellCheck={false}
          className="harness-scroll harness-focus h-full w-full resize-none rounded-md border border-border bg-card p-3 font-mono text-[12.5px] leading-relaxed text-foreground outline-none"
        />
        {parseError && (
          <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/5 p-2">
            <div className="text-[10.5px] font-medium uppercase tracking-wide text-destructive">Parse error</div>
            <pre className="m-0 mt-1 whitespace-pre-wrap font-mono text-[11.5px] text-destructive">{parseError}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

function Preview({ widget, rawJson, servers }: { widget: Widget | null; rawJson: string; servers: McpServerSummary[] }) {
  const [pluginFunctions, setPluginFunctions] = useState<Record<string, (a: Record<string, unknown>) => unknown>>({});
  const [pluginComponents, setPluginComponents] = useState<Record<string, React.ComponentType<any>>>({});
  useEffect(() => {
    loadAllPluginElements().then(({ functions, components }) => {
      setPluginFunctions(functions);
      setPluginComponents(components);
    });
  }, []);
  const allFunctions = useMemo(() => ({ ...systemFunctions, ...pluginFunctions }), [pluginFunctions]);
  const allComponents = useMemo(() => ({ ...components, ...pluginComponents }), [pluginComponents]);
  const tools = useMemo(() => servers.flatMap((s) => s.tools), [servers]);
  const catalog = useMemo(() => buildCatalog(tools, allComponents), [tools, allComponents]);
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
    return defineRegistry(catalog as never, { components: allComponents as never, actions: stubs as never });
  }, [catalog, handlers, allComponents]);

  // Fallback for unknown component types — keeps the render alive instead of
  // returning null and yielding cryptic "cannot convert undefined" errors.
  const fallback = useCallback(
    ({ element, children }: { element: { type: string; props?: any }; children?: React.ReactNode }) =>
      React.createElement(UnknownComponent as any, { __type: element.type, props: element.props, children }),
    [],
  );

  useEffect(() => {
    if (!widget?.dataProvider) return;
    const { mcp, tool, params } = widget.dataProvider;
    const handler = handlers[`${mcp}.${tool}`];
    if (!handler) return;
    void handler(params ?? {});
  }, [widget, handlers]);

  // Preview cell count — seeds from widget.sizing.preferred when available,
  // editable via SE drag handle. `null` means "fill container".
  const preferred = widget?.sizing?.preferred;
  const [cells, setCells] = useState<{ cols: number; rows: number } | null>(
    preferred ? { cols: preferred.colSpan, rows: preferred.rowSpan } : { cols: 4, rows: 4 },
  );
  const sizeKey = preferred ? `${preferred.colSpan}x${preferred.rowSpan}` : '';
  useEffect(() => {
    if (preferred) setCells({ cols: preferred.colSpan, rows: preferred.rowSpan });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sizeKey]);

  // SE-corner pointer resize: top-left fixed, dx/dy → cell deltas.
  const resizeStartRef = useRef<{ x: number; y: number; cols: number; rows: number } | null>(null);
  const onResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (!cells) return;
      resizeStartRef.current = { x: e.clientX, y: e.clientY, cols: cells.cols, rows: cells.rows };
      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);
      const step = GRID_CELL + GRID_GAP;
      const onMove = (ev: PointerEvent) => {
        const s = resizeStartRef.current;
        if (!s) return;
        const dCol = Math.round((ev.clientX - s.x) / step);
        const dRow = Math.round((ev.clientY - s.y) / step);
        setCells({
          cols: Math.max(1, Math.min(16, s.cols + dCol)),
          rows: Math.max(1, Math.min(12, s.rows + dRow)),
        });
      };
      const onUp = () => {
        resizeStartRef.current = null;
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        try { el.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [cells],
  );

  if (!widget) {
    return (
      <div className="flex min-h-0 flex-col items-center justify-center p-8 text-sm text-muted-foreground">
        Fix the JSON to see a preview.
      </div>
    );
  }

  const dims = cells ? sizePx(cells.cols, cells.rows) : null;

  return (
    <div className="harness-scroll flex min-h-0 flex-col overflow-auto bg-background">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <h2 className="truncate text-[13px] font-medium">
          Preview <span className="text-muted-foreground">— {widget.title ?? 'untitled'}</span>
        </h2>
        <div className="flex items-center gap-2">
          {cells && (
            <span className="font-mono text-[10.5px] text-muted-foreground">
              {cells.cols}×{cells.rows} · {dims!.width}×{dims!.height}px
            </span>
          )}
          <select
            value={cells ? `${cells.cols}x${cells.rows}` : 'fill'}
            onChange={(e) => {
              const v = e.target.value;
              if (v === 'fill') return setCells(null);
              const [c, r] = v.split('x').map(Number);
              setCells({ cols: c, rows: r });
            }}
            className="harness-focus h-7 rounded-md border border-border bg-card px-2 text-[12px] text-foreground"
          >
            {['2x2', '3x3', '4x4', '6x3', '6x4', '8x5'].map((s) => <option key={s} value={s}>{s}</option>)}
            <option value="fill">fill</option>
          </select>
        </div>
      </div>
      <div className="flex flex-1 min-h-0 items-start justify-start p-4">
        <div
          className="relative overflow-hidden rounded-md border border-border bg-card shadow-sm"
          style={dims ? { width: `${dims.width}px`, height: `${dims.height}px` } : { minHeight: 240, width: '100%' }}
        >
          <WidgetErrorBoundary resetKey={rawJson}>
            <JSONUIProvider registry={registry} store={store} handlers={handlers} functions={allFunctions}>
              <Renderer spec={widget.spec as any} registry={registry} fallback={fallback as any} />
            </JSONUIProvider>
          </WidgetErrorBoundary>
          {cells && (
            <div
              role="slider"
              aria-label="Resize preview"
              onPointerDown={onResizePointerDown}
              className="absolute -bottom-px -right-px h-3.5 w-3.5 cursor-se-resize bg-muted-foreground/50"
              style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── ConnectionsView ───────────────────────────────────────────────────

function ConnectionsView({ servers, error, onReload }: { servers: McpServerSummary[]; error: string | null; onReload: () => void }) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    if (!query.trim()) return servers;
    const q = query.toLowerCase();
    return servers.filter((s) => s.name.toLowerCase().includes(q) || s.source?.kind === 'plugin' && s.source.slug.toLowerCase().includes(q));
  }, [servers, query]);
  const connected = filtered.filter((s) => !s.failure && !s.awaitingAuth);
  const blocked = filtered.filter((s) => s.failure || s.awaitingAuth);

  return (
    <div className="harness-scroll flex h-full min-h-0 flex-col overflow-auto bg-background">
      <div className="flex items-center gap-3 border-b border-border bg-card px-6 py-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search servers…"
          className="harness-focus h-8 w-72 rounded-md border border-border bg-background px-2.5 text-[12.5px] outline-none placeholder:text-muted-foreground"
        />
        <div className="ml-auto flex items-center gap-2 text-[12px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Dot state={connected.length ? 'ok' : 'muted'} />
            {connected.length} connected
          </span>
          {blocked.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-warning">
              <Dot state="warn" />
              {blocked.length} blocked
            </span>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1400px] px-6 py-6">
        {error && (
          <div className="mb-5 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-[12.5px] text-destructive">
            {error}
          </div>
        )}
        {servers.length === 0 && !error && (
          <div className="rounded-md border border-border bg-card px-6 py-10 text-center text-sm text-muted-foreground">
            No MCP servers running. Check <code className="font-mono">plugin/.mcp.json</code> and the server logs.
          </div>
        )}

        {blocked.length > 0 && (
          <section className="mb-8">
            <SectionHeader label="Awaiting authorization" count={blocked.length} tone="warn" />
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))' }}>
              {blocked.map((s) => <McpServerCard key={s.name} server={s} onReload={onReload} />)}
            </div>
          </section>
        )}
        {connected.length > 0 && (
          <section className="mb-8">
            <SectionHeader label="Connected" count={connected.length} tone="ok" />
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))' }}>
              {connected.map((s) => <McpServerCard key={s.name} server={s} onReload={onReload} />)}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ label, count, tone }: { label: string; count: number; tone: 'ok' | 'warn' }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <Dot state={tone} />
      <h3 className="text-sm font-medium">{label}</h3>
      <span className="rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground">{count}</span>
    </div>
  );
}

function McpServerCard({ server: s, onReload }: { server: McpServerSummary; onReload: () => void }) {
  const canLogin = s.transport === 'http' || s.transport === 'sse';
  const [showPaste, setShowPaste] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Listen for the callback page's postMessage so we can reload as soon as
  // the user finishes the OAuth flow in the other tab. The popup-id check
  // could be tighter, but the harness is single-origin localhost so trust
  // the same-origin postMessage event.
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const data = e.data as { ok?: boolean; server?: string };
      if (data && typeof data === 'object' && 'ok' in data) {
        if (!data.server || data.server === s.name) {
          setBusy(false);
          if (data.ok) setLoginError(null);
          onReload();
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [s.name, onReload]);

  async function startOAuth() {
    setBusy(true);
    setLoginError(null);
    try {
      const res = await fetch(`/api/mcp/oauth/${encodeURIComponent(s.name)}/start`, { method: 'POST' });
      const body = await res.json();
      if (!body.ok || !body.authorizationUrl) {
        setLoginError(body.error ?? 'failed to start OAuth flow');
        setBusy(false);
        return;
      }
      // Pop the auth URL. Popup blockers usually let this through since it's
      // user-initiated; if not, surface a click-through link.
      const w = window.open(body.authorizationUrl, '_blank', 'noopener=no');
      if (!w) {
        setLoginError(`Popup blocked. Open this URL: ${body.authorizationUrl}`);
        setBusy(false);
      }
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }

  async function clearOAuth() {
    setBusy(true);
    try {
      await fetch(`/api/mcp/oauth/${encodeURIComponent(s.name)}`, { method: 'DELETE' });
      onReload();
    } finally { setBusy(false); }
  }

  async function saveToken() {
    if (!tokenInput.trim()) return;
    setBusy(true);
    setLoginError(null);
    try {
      const res = await fetch(`/api/mcp/auth/${encodeURIComponent(s.name)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: tokenInput.trim() }),
      });
      const body = await res.json();
      if (!body.ok) setLoginError(body.error ?? 'reconnect failed');
      else {
        setShowPaste(false);
        setTokenInput('');
      }
      onReload();
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function clearToken() {
    setBusy(true);
    setLoginError(null);
    try {
      await fetch(`/api/mcp/auth/${encodeURIComponent(s.name)}`, { method: 'DELETE' });
      onReload();
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const connected = !s.failure && !s.awaitingAuth;
  const state: 'ok' | 'warn' | 'error' = connected ? 'ok' : s.awaitingAuth ? 'warn' : 'error';
  const [open, setOpen] = useState<boolean>(Boolean(s.failure || s.awaitingAuth));

  return (
    <article className="flex flex-col rounded-md border border-border bg-card">
      <button
        onClick={() => setOpen((v) => !v)}
        className="harness-focus flex w-full items-start gap-3 px-3.5 py-3 text-left"
      >
        <span className="mt-1.5"><Dot state={state} /></span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="truncate text-[13.5px] font-medium">{s.name}</span>
            {s.source?.kind === 'plugin' && (
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {s.source.slug}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            {s.transport && <span>{s.transport}</span>}
            {s.transport && (s.hasOAuth || s.hasToken || s.authRequired) && <span>·</span>}
            {s.hasOAuth && <span className="text-success">OAuth</span>}
            {s.hasToken && <span className="text-success">token</span>}
            {!s.hasOAuth && !s.hasToken && s.authRequired && <span className="text-warning">auth required</span>}
            <span>·</span>
            <span>
              {connected ? `${s.tools.length} tools` : s.awaitingAuth ? 'awaiting auth' : 'failed'}
            </span>
          </div>
        </div>
        <span aria-hidden className="mt-1 text-muted-foreground">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="border-t border-border">
          {s.failure && (
            <div className="border-b border-border bg-destructive/5 px-3.5 py-2.5">
              <div className="text-[10.5px] font-medium uppercase tracking-wide text-destructive">Server response</div>
              <div className="mt-1 break-all font-mono text-[11px] leading-relaxed text-destructive">{s.failure}</div>
            </div>
          )}

          {canLogin && (
            <div className="border-b border-border px-3.5 py-3">
              <div className="mb-2 text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">Authorization</div>
              {showPaste ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="password"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="bearer token…"
                    className="harness-focus h-7 flex-1 min-w-[180px] rounded-md border border-border bg-background px-2 font-mono text-[12px] outline-none placeholder:text-muted-foreground"
                  />
                  <ActionButton tone="primary" onClick={saveToken} disabled={busy || !tokenInput.trim()}>Save</ActionButton>
                  <ActionButton tone="ghost" onClick={() => { setShowPaste(false); setTokenInput(''); setLoginError(null); }}>Cancel</ActionButton>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <ActionButton tone="primary" onClick={startOAuth} disabled={busy}>
                    {busy ? 'Opening…' : s.hasOAuth ? 'Re-authorize' : 'Login with OAuth'}
                  </ActionButton>
                  {s.hasOAuth && <ActionButton tone="danger" onClick={clearOAuth} disabled={busy}>Sign out</ActionButton>}
                  <ActionButton tone="ghost" onClick={() => setShowPaste(true)} disabled={busy}>
                    {s.hasToken ? 'Update token' : 'Paste token'}
                  </ActionButton>
                  {s.hasToken && <ActionButton tone="danger" onClick={clearToken} disabled={busy}>Clear</ActionButton>}
                </div>
              )}
              {loginError && (
                <div className="mt-2 break-all font-mono text-[11px] text-destructive">{loginError}</div>
              )}
            </div>
          )}

          {!s.failure && s.tools.length > 0 && (
            <div className="harness-scroll px-3.5 py-3" style={{ maxHeight: 260, overflow: 'auto' }}>
              <div className="mb-2 text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">
                Tools · {s.tools.length}
              </div>
              <ul className="m-0 list-none space-y-1 p-0">
                {s.tools.map((t) => (
                  <li key={t.name} className="grid gap-2" style={{ gridTemplateColumns: '14ch 1fr' }}>
                    <span className="font-mono text-[11.5px]">{t.name}</span>
                    {t.description && (
                      <span className="truncate text-[12px] text-muted-foreground">{t.description}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  tone = 'ghost',
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'ghost' | 'danger';
}) {
  const toneClasses: Record<string, string> = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    ghost: 'border border-border bg-card text-foreground hover:bg-muted/60',
    danger: 'border border-destructive/40 bg-card text-destructive hover:bg-destructive/10',
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`harness-focus inline-flex h-7 items-center rounded-md px-2.5 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${toneClasses[tone]}`}
    >
      {children}
    </button>
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
