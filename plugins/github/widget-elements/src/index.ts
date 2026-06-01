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

const elements: PluginElementsModule = {
  slug: 'github',
  functions: {
    issue_labels_text,
    issue_state_tone,
    project_rows,
    count_open,
  },
};

export default elements;
