/**
 * github — widget-elements module
 *
 * Helpers tailored to the response shapes of GitHub's hosted MCP
 * server (https://api.githubcopilot.com/mcp/):
 *
 *  - `list_issues` returns `{ issues: MinimalIssue[], totalCount, pageInfo }`.
 *    Each issue's `labels` can arrive as a string[] OR an array of
 *    `{ name, color? }` objects depending on the toolset version, so
 *    `issue_labels_text` normalises both into one comma-joined string.
 *
 *  - `projects_list` (method `list_projects`) returns
 *    `{ projects: MinimalProject[], pageInfo, note? }`. A project is
 *    "closed" when `closed_at` is set. MinimalProject carries `owner`,
 *    `owner_type` and `number`, so `project_rows` can also reconstruct
 *    the web URL the API itself doesn't return.
 *
 * Keeping the shape-wrangling here means the widget JSON stays a flat,
 * declarative description of the layout.
 */

import type { ComputedFunction, PluginElementsModule } from './types.js';

// ── shared coercion ─────────────────────────────────────────────────

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  // Tolerate the wrapped `{ issues: [...] }` / `{ projects: [...] }`
  // forms in case a caller passes the whole tool result through.
  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>;
    if (Array.isArray(v.issues)) return v.issues;
    if (Array.isArray(v.projects)) return v.projects;
    if (Array.isArray(v.items)) return v.items;
  }
  return [];
}

function str(value: unknown): string {
  return value == null ? '' : String(value);
}

// ── issue_labels_text ───────────────────────────────────────────────
//
// Flatten an issue's `labels` into a single readable string. Handles
// both `["bug", "p1"]` and `[{ name: "bug" }, { name: "p1" }]`.
//
// Args: { value: unknown } — the issue's labels field
// Returns: string, e.g. "bug · enhancement" (empty string if none)

const issue_labels_text: ComputedFunction = (args) => {
  const labels = asArray(args.value);
  const names = labels
    .map((l) => {
      if (typeof l === 'string') return l;
      if (l && typeof l === 'object') return str((l as Record<string, unknown>).name);
      return '';
    })
    .map((s) => s.trim())
    .filter(Boolean);
  return names.join(' · ');
};

// ── issue_state_tone ────────────────────────────────────────────────
//
// Map an issue `state` to a badge tone. Open issues read as active
// work (success/green); closed ones recede (muted).
//
// Args: { value: string } — issue state ("open" | "closed")

const issue_state_tone: ComputedFunction = (args) => {
  const s = str(args.value).toLowerCase();
  if (s === 'open') return 'success';
  if (s === 'closed') return 'muted';
  return 'default';
};

// ── project_rows ────────────────────────────────────────────────────
//
// Normalise a `projects_list` (method=list_projects) response into a
// stable array of roadmap rows. Accepts either the wrapped
// `{ projects: [...] }` object or a bare array. Open projects sort
// first; within a state, most-recently-updated first.
//
// Args: { value: unknown } — the projects_list result
// Returns: Array<{ id, number, title, description, state, tone,
//                  isPublic, visibility, updated_at, url }>

interface MinimalProject {
  id?: number | string;
  number?: number;
  title?: string;
  description?: string;
  short_description?: string;
  public?: boolean;
  closed_at?: string | null;
  updated_at?: string;
  owner?: string | { login?: string };
  owner_type?: string;
}

function ownerLogin(owner: MinimalProject['owner']): string {
  if (typeof owner === 'string') return owner;
  if (owner && typeof owner === 'object') return str(owner.login);
  return '';
}

function projectUrl(p: MinimalProject): string {
  const login = ownerLogin(p.owner);
  const num = p.number;
  if (!login || num == null) return '';
  const segment = str(p.owner_type).toLowerCase().startsWith('org') ? 'orgs' : 'users';
  return `https://github.com/${segment}/${login}/projects/${num}`;
}

const project_rows: ComputedFunction = (args) => {
  const projects = asArray(args.value) as MinimalProject[];
  const rows = projects.map((p) => {
    const closed = Boolean(p.closed_at);
    const description = str(p.short_description) || str(p.description);
    const isPublic = p.public === true;
    return {
      id: p.id ?? p.number ?? '',
      number: p.number ?? null,
      title: str(p.title) || `Project #${str(p.number)}`,
      description,
      state: closed ? 'Closed' : 'Open',
      tone: closed ? 'muted' : 'success',
      isPublic,
      visibility: isPublic ? 'Public' : 'Private',
      updated_at: str(p.updated_at),
      url: projectUrl(p),
      _closed: closed,
    };
  });
  rows.sort((a, b) => {
    if (a._closed !== b._closed) return a._closed ? 1 : -1;
    return b.updated_at.localeCompare(a.updated_at);
  });
  // Drop the internal sort key before handing rows to the renderer.
  return rows.map(({ _closed, ...rest }) => rest);
};

// ── count_open ──────────────────────────────────────────────────────
//
// Count entries whose `state`/`_closed` mark them open. Works on either
// raw issues (state === "open") or normalised project rows
// (state === "Open"). Used for the header eyebrow.
//
// Args: { value: unknown[] }

const count_open: ComputedFunction = (args) => {
  const rows = asArray(args.value) as Array<Record<string, unknown>>;
  return rows.filter((r) => str(r.state).toLowerCase() === 'open').length;
};

// ── gantt_status_tone ───────────────────────────────────────────────
//
// Map a GitHub Project v2 Status single-select value to a tone for the
// Gantt bar. The status names used here match the defaults in the
// "myHub Requirements" project (#3). Anything we don't recognise falls
// back to `accent` so an unfilled bar is still visible rather than a
// silent no-op.
//
// Args: { value: string } — the Status field's text value

const gantt_status_tone: ComputedFunction = (args) => {
  const s = str(args.value).toLowerCase();
  if (s === 'done' || s === 'closed') return 'success';
  if (s === 'in progress' || s === 'in review') return 'accent';
  if (s === 'blocked' || s === 'on hold') return 'destructive';
  if (s === 'todo' || s === 'backlog' || s === 'planned') return 'info';
  return 'accent';
};

// ── gantt_data ──────────────────────────────────────────────────────
//
// Normalise a "project items + iterations" payload into the shape the
// Gantt widget renders. Accepts the response of whatever MCP tool the
// data provider points at — the wrapping is tolerated so the widget
// JSON doesn't have to know the precise envelope.
//
// Expected (canonical) input:
//   {
//     iterations: [{ id, title, startDate, duration }, …],   // active + completed, time-ordered
//     items:      [{
//       id, number, title, status, url,
//       iterationId,                  // matches one of iterations[].id
//     }, …]
//   }
//
// Tolerated variants:
//   - The whole `projects_list_items` / GraphQL response with items
//     nested under `.items` and iterations under `.field.configuration.iterations`.
//     The function flattens those shapes.
//   - An item's `iteration` may arrive as either the bare id string or
//     an object `{ iterationId, title, startDate }` — both are handled.
//
// Output:
//   {
//     iterations: [{ id, title, startDate }, …],          // sorted by startDate asc
//     items: [{
//       id, number, title, status, statusTone, url,
//       iterationId, iterationIndex,                       // 0-based slot in iterations[]
//       template: string,                                   // CSS grid-template-columns
//                                                          // for one Row: "180px 0fr … 1fr … 0fr"
//     }, …]
//   }
//
// The `template` string drives the visual bar position. The Row that
// consumes it has exactly (1 + iterations.length + 1) children — a
// fixed-width title cell, then one cell per iteration, ending with the
// item's bar cell positioned by the `1fr` slot in `template`.

interface RawIteration {
  id?: string;
  title?: string;
  startDate?: string;
  duration?: number;
}

interface RawItem {
  id?: string | number;
  number?: number;
  title?: string;
  status?: string | { name?: string };
  state?: string;
  url?: string;
  iterationId?: string;
  iteration?: string | { id?: string; iterationId?: string; title?: string };
  content?: { number?: number; title?: string; url?: string; html_url?: string; repository_url?: string; state?: string };
  // GitHub's REST `list_project_items` nests each field's value here, e.g.
  // { id, name: "Iteration", data_type: "iteration", value: { id, start_date, duration, title: { raw } } }.
  fields?: Array<{ id?: number | string; name?: string; data_type?: string; value?: unknown }>;
}

// A GitHub Projects field value can wrap its display text as { raw, html }.
// Unwrap to the bare string; pass plain strings through unchanged.
function unwrapRaw(value: unknown): string {
  if (value && typeof value === 'object' && 'raw' in (value as Record<string, unknown>)) {
    return str((value as { raw?: unknown }).raw);
  }
  return str(value);
}

// Read a field's `value` from the REST `item.fields[]` array, matched by
// `data_type` (e.g. "iteration") and/or exact field `name` (e.g. "Status").
function restFieldValue(
  item: RawItem,
  match: { dataType?: string; name?: string },
): Record<string, unknown> | string | null {
  if (!Array.isArray(item.fields)) return null;
  const f = item.fields.find(
    (x) =>
      x &&
      (match.dataType ? x.data_type === match.dataType : true) &&
      (match.name ? x.name === match.name : true),
  );
  if (!f || f.value == null) return null;
  return f.value as Record<string, unknown> | string;
}

function extractIterations(payload: unknown): RawIteration[] {
  if (Array.isArray(payload)) {
    // A bare list of project ITEMS (each carrying `content`/`fields`) is not
    // an iterations list — return none so iterations get derived from items.
    if (payload.some((x) => x && typeof x === 'object' && ('content' in x || 'fields' in x))) {
      return [];
    }
    return payload as RawIteration[];
  }
  if (payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>;
    if (Array.isArray(p.iterations)) return p.iterations as RawIteration[];
    // GraphQL-style envelope: field.configuration.{iterations, completedIterations}.
    const config = (p.field as { configuration?: { iterations?: RawIteration[]; completedIterations?: RawIteration[] } } | undefined)?.configuration;
    if (config) {
      const active = Array.isArray(config.iterations) ? config.iterations : [];
      const done = Array.isArray(config.completedIterations) ? config.completedIterations : [];
      return [...done, ...active];
    }
  }
  return [];
}

function extractItems(payload: unknown): RawItem[] {
  if (Array.isArray(payload)) return payload as RawItem[];
  if (payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>;
    if (Array.isArray(p.items)) return p.items as RawItem[];
    if (Array.isArray(p.nodes)) return p.nodes as RawItem[];
  }
  return [];
}

function itemIterationId(item: RawItem): string | null {
  if (typeof item.iterationId === 'string' && item.iterationId) return item.iterationId;
  const it = item.iteration;
  if (typeof it === 'string') return it;
  if (it && typeof it === 'object') return str(it.iterationId) || str(it.id) || null;
  // REST `list_project_items` shape: iteration nested in fields[].value.id.
  const rest = restFieldValue(item, { dataType: 'iteration' });
  if (rest && typeof rest === 'object') return str((rest as { id?: unknown }).id) || null;
  return null;
}

function itemStatus(item: RawItem): string {
  if (typeof item.status === 'string') return item.status;
  if (item.status && typeof item.status === 'object') return str(item.status.name);
  if (item.state) return item.state;
  // REST shape: the single-select "Status" field's value.name ({ raw }).
  const rest = restFieldValue(item, { dataType: 'single_select', name: 'Status' });
  if (rest && typeof rest === 'object') return unwrapRaw((rest as { name?: unknown }).name);
  return '';
}

function buildTemplate(iterationIndex: number, total: number): string {
  // 180px title column + total cells (one per iteration). Active cell
  // gets 1fr; siblings get 0fr so they collapse to zero width while
  // still occupying a grid slot for `children[]` alignment.
  const cells: string[] = ['180px'];
  for (let i = 0; i < total; i++) {
    cells.push(i === iterationIndex ? '1fr' : '0fr');
  }
  return cells.join(' ');
}

// ── card-label cleanup ──────────────────────────────────────────────
// Turn a raw issue title into a compact card label: drop a leading
// "#123"/"123:" and a "Epic:/Bug:/Feature:" type prefix, then trim.
function cleanLabel(title: string): string {
  return title
    .replace(/^\s*#?\d+\s*[:.–-]?\s*/, '')
    .replace(/^\s*(epic|bug|feature|chore|task|story)\s*[:–-]\s*/i, '')
    .trim();
}

// ── release-week header ─────────────────────────────────────────────
// An iteration's last day is when its work ships, so the column header is
// "Ships week of <month> <day>" derived from start_date + duration.
function iterationEnd(startDate: string, duration?: number): Date | null {
  if (!startDate) return null;
  const start = new Date(startDate + 'T00:00:00Z');
  if (Number.isNaN(start.getTime())) return null;
  const days = duration && duration > 0 ? duration : 1;
  return new Date(start.getTime() + (days - 1) * 86400000);
}
function shipWeekLabel(startDate: string, duration?: number): string {
  const end = iterationEnd(startDate, duration);
  if (!end) return '';
  const month = end.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  return `Ships week of ${month} ${end.getUTCDate()}`;
}

// Parse owner/repo from a REST `repository_url` so a card click can address
// the issue (owner/repo/number) for the detail modal.
function ownerRepo(item: RawItem): { owner: string; repo: string } {
  // The Copilot MCP item shape varies — owner/repo may live in an API
  // `repository_url` (…/repos/OWNER/REPO) or only in a web `html_url`
  // (github.com/OWNER/REPO/…). Try every URL field and both patterns.
  const c = item.content ?? {};
  for (const u of [c.repository_url, c.html_url, c.url, item.url]) {
    const s = str(u);
    const m = s.match(/repos\/([^/]+)\/([^/]+)/) || s.match(/github\.com\/([^/]+)\/([^/]+?)(?:\/|$)/);
    if (m) return { owner: m[1], repo: m[2] };
  }
  return { owner: '', repo: '' };
}

interface BoardItem {
  id: string;
  number: number | null;
  owner: string;
  repo: string;
  label: string;
  status: string;
  statusTone: string;
  url: string;
}

// Normalise project items into release-week columns for the board layout:
//   { columns: [{ id, label, count, items: BoardItem[] }, …], total }
// Items with no iteration land in a trailing "No date yet" column.
const board_data: ComputedFunction = (args) => {
  const rawItems = extractItems(args.value);
  const UNSCHEDULED = '__unscheduled__';

  const cols = new Map<string, { id: string; label: string; shipDate: string; items: BoardItem[] }>();

  for (const raw of rawItems) {
    const status = itemStatus(raw);
    // Exclude shipped work — the board shows what's still upcoming/in flight.
    if (/^(done|closed)$/i.test(status.trim())) continue;

    const colId = itemIterationId(raw) || UNSCHEDULED;

    if (!cols.has(colId)) {
      if (colId === UNSCHEDULED) {
        cols.set(colId, { id: colId, label: 'No date yet', shipDate: '9999-12-31', items: [] });
      } else {
        const v = restFieldValue(raw, { dataType: 'iteration' });
        const iv = v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
        const start = str(iv.start_date);
        const dur = Number(iv.duration) || undefined;
        const end = iterationEnd(start, dur);
        cols.set(colId, {
          id: colId,
          label: shipWeekLabel(start, dur) || unwrapRaw(iv.title) || colId,
          shipDate: end ? end.toISOString().slice(0, 10) : '9999-12-30',
          items: [],
        });
      }
    }

    const number =
      typeof raw.number === 'number'
        ? raw.number
        : typeof raw.content?.number === 'number'
          ? raw.content.number
          : null;
    const title = str(raw.title) || str(raw.content?.title) || (number != null ? `#${number}` : '');
    const { owner, repo } = ownerRepo(raw);

    cols.get(colId)!.items.push({
      id: str(raw.id) || (number != null ? `i${number}` : title),
      number,
      owner,
      repo,
      label: cleanLabel(title) || title,
      status,
      statusTone: (gantt_status_tone({ value: status }) as string) || 'accent',
      url: str(raw.url) || str(raw.content?.html_url) || str(raw.content?.url),
    });
  }

  const columns = [...cols.values()]
    .sort((a, b) => a.shipDate.localeCompare(b.shipDate))
    .map((c) => ({
      id: c.id,
      label: c.label,
      count: c.items.length,
      items: c.items.sort((a, b) => a.label.localeCompare(b.label)),
    }));

  return { columns, total: columns.reduce((n, c) => n + c.count, 0) };
};

const elements: PluginElementsModule = {
  slug: 'github',
  functions: {
    issue_labels_text,
    issue_state_tone,
    project_rows,
    count_open,
    gantt_status_tone,
    board_data,
  },
};

export default elements;
