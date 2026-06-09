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
// ── shared coercion ─────────────────────────────────────────────────
function asArray(value) {
    if (Array.isArray(value))
        return value;
    // Tolerate the wrapped `{ issues: [...] }` / `{ projects: [...] }`
    // forms in case a caller passes the whole tool result through.
    if (value && typeof value === 'object') {
        const v = value;
        if (Array.isArray(v.issues))
            return v.issues;
        if (Array.isArray(v.projects))
            return v.projects;
        if (Array.isArray(v.items))
            return v.items;
    }
    return [];
}
function str(value) {
    return value == null ? '' : String(value);
}
// ── issue_labels_text ───────────────────────────────────────────────
//
// Flatten an issue's `labels` into a single readable string. Handles
// both `["bug", "p1"]` and `[{ name: "bug" }, { name: "p1" }]`.
//
// Args: { value: unknown } — the issue's labels field
// Returns: string, e.g. "bug · enhancement" (empty string if none)
const issue_labels_text = (args) => {
    const labels = asArray(args.value);
    const names = labels
        .map((l) => {
        if (typeof l === 'string')
            return l;
        if (l && typeof l === 'object')
            return str(l.name);
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
const issue_state_tone = (args) => {
    const s = str(args.value).toLowerCase();
    if (s === 'open')
        return 'success';
    if (s === 'closed')
        return 'muted';
    return 'default';
};
function ownerLogin(owner) {
    if (typeof owner === 'string')
        return owner;
    if (owner && typeof owner === 'object')
        return str(owner.login);
    return '';
}
function projectUrl(p) {
    const login = ownerLogin(p.owner);
    const num = p.number;
    if (!login || num == null)
        return '';
    const segment = str(p.owner_type).toLowerCase().startsWith('org') ? 'orgs' : 'users';
    return `https://github.com/${segment}/${login}/projects/${num}`;
}
const project_rows = (args) => {
    const projects = asArray(args.value);
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
        if (a._closed !== b._closed)
            return a._closed ? 1 : -1;
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
const count_open = (args) => {
    const rows = asArray(args.value);
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
const gantt_status_tone = (args) => {
    const s = str(args.value).toLowerCase();
    if (s === 'done' || s === 'closed')
        return 'success';
    if (s === 'in progress' || s === 'in review')
        return 'accent';
    if (s === 'blocked' || s === 'on hold')
        return 'destructive';
    if (s === 'todo' || s === 'backlog' || s === 'planned')
        return 'info';
    return 'accent';
};
function extractIterations(payload) {
    if (Array.isArray(payload))
        return payload;
    if (payload && typeof payload === 'object') {
        const p = payload;
        if (Array.isArray(p.iterations))
            return p.iterations;
        // GraphQL-style envelope: field.configuration.{iterations, completedIterations}.
        const config = p.field?.configuration;
        if (config) {
            const active = Array.isArray(config.iterations) ? config.iterations : [];
            const done = Array.isArray(config.completedIterations) ? config.completedIterations : [];
            return [...done, ...active];
        }
    }
    return [];
}
function extractItems(payload) {
    if (Array.isArray(payload))
        return payload;
    if (payload && typeof payload === 'object') {
        const p = payload;
        if (Array.isArray(p.items))
            return p.items;
        if (Array.isArray(p.nodes))
            return p.nodes;
    }
    return [];
}
function itemIterationId(item) {
    if (typeof item.iterationId === 'string' && item.iterationId)
        return item.iterationId;
    const it = item.iteration;
    if (typeof it === 'string')
        return it;
    if (it && typeof it === 'object')
        return str(it.iterationId) || str(it.id) || null;
    return null;
}
function itemStatus(item) {
    if (typeof item.status === 'string')
        return item.status;
    if (item.status && typeof item.status === 'object')
        return str(item.status.name);
    if (item.state)
        return item.state;
    return '';
}
function buildTemplate(iterationIndex, total) {
    // 180px title column + total cells (one per iteration). Active cell
    // gets 1fr; siblings get 0fr so they collapse to zero width while
    // still occupying a grid slot for `children[]` alignment.
    const cells = ['180px'];
    for (let i = 0; i < total; i++) {
        cells.push(i === iterationIndex ? '1fr' : '0fr');
    }
    return cells.join(' ');
}
const gantt_data = (args) => {
    const rawIterations = extractIterations(args.value);
    const iterations = rawIterations
        .map((it) => ({
        id: str(it.id),
        title: str(it.title) || str(it.id),
        startDate: str(it.startDate),
    }))
        .filter((it) => it.id)
        .sort((a, b) => a.startDate.localeCompare(b.startDate));
    const idToIndex = new Map();
    iterations.forEach((it, i) => idToIndex.set(it.id, i));
    const rawItems = extractItems(args.value);
    const items = rawItems
        .map((raw) => {
        const iterationId = itemIterationId(raw);
        if (!iterationId || !idToIndex.has(iterationId))
            return null;
        const iterationIndex = idToIndex.get(iterationId) ?? 0;
        const number = typeof raw.number === 'number'
            ? raw.number
            : typeof raw.content?.number === 'number'
                ? raw.content.number
                : null;
        const title = str(raw.title) || str(raw.content?.title) || (number != null ? `#${number}` : '');
        const url = str(raw.url) || str(raw.content?.url);
        const status = itemStatus(raw);
        return {
            id: str(raw.id) || (number != null ? `i${number}` : title),
            number,
            title,
            status,
            statusTone: gantt_status_tone({ value: status }) || 'accent',
            url,
            iterationId,
            iterationIndex,
            template: buildTemplate(iterationIndex, iterations.length),
        };
    })
        .filter((x) => x !== null);
    // Earliest iteration first, then alphabetical title within an iteration.
    items.sort((a, b) => {
        if (a.iterationIndex !== b.iterationIndex)
            return a.iterationIndex - b.iterationIndex;
        return a.title.localeCompare(b.title);
    });
    return { iterations, items };
};
const elements = {
    slug: 'github',
    functions: {
        issue_labels_text,
        issue_state_tone,
        project_rows,
        count_open,
        gantt_status_tone,
        gantt_data,
    },
};
export default elements;
