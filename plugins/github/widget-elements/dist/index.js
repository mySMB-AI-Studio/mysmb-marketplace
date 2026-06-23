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
// A GitHub Projects field value can wrap its display text as { raw, html }.
// Unwrap to the bare string; pass plain strings through unchanged.
function unwrapRaw(value) {
    if (value && typeof value === 'object' && 'raw' in value) {
        return str(value.raw);
    }
    return str(value);
}
// Read a field's `value` from the REST `item.fields[]` array, matched by
// `data_type` (e.g. "iteration") and/or exact field `name` (e.g. "Status").
function restFieldValue(item, match) {
    if (!Array.isArray(item.fields))
        return null;
    const f = item.fields.find((x) => x &&
        (match.dataType ? x.data_type === match.dataType : true) &&
        (match.name ? x.name === match.name : true));
    if (!f || f.value == null)
        return null;
    return f.value;
}
function extractIterations(payload) {
    if (Array.isArray(payload)) {
        // A bare list of project ITEMS (each carrying `content`/`fields`) is not
        // an iterations list — return none so iterations get derived from items.
        if (payload.some((x) => x && typeof x === 'object' && ('content' in x || 'fields' in x))) {
            return [];
        }
        return payload;
    }
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
    // REST `list_project_items` shape: iteration nested in fields[].value.id.
    const rest = restFieldValue(item, { dataType: 'iteration' });
    if (rest && typeof rest === 'object')
        return str(rest.id) || null;
    return null;
}
function itemStatus(item) {
    if (typeof item.status === 'string')
        return item.status;
    if (item.status && typeof item.status === 'object')
        return str(item.status.name);
    if (item.state)
        return item.state;
    // REST shape: the single-select "Status" field's value.name ({ raw }).
    const rest = restFieldValue(item, { dataType: 'single_select', name: 'Status' });
    if (rest && typeof rest === 'object')
        return unwrapRaw(rest.name);
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
// ── card-label cleanup ──────────────────────────────────────────────
// Turn a raw issue title into a compact card label: drop a leading
// "#123"/"123:" and a "Epic:/Bug:/Feature:" type prefix, then trim.
function cleanLabel(title) {
    return title
        .replace(/^\s*#?\d+\s*[:.–-]?\s*/, '')
        .replace(/^\s*(epic|bug|feature|chore|task|story)\s*[:–-]\s*/i, '')
        // Strip a leading short code prefix like "UC-08:" / "UC08 -".
        .replace(/^\s*[A-Za-z]{1,5}-?\d+\s*[:–-]\s*/, '')
        .trim();
}
// ── release-week header ─────────────────────────────────────────────
// An iteration's last day is when its work ships, so the column header is
// "Ships week of <month> <day>" derived from start_date + duration.
function iterationEnd(startDate, duration) {
    if (!startDate)
        return null;
    const start = new Date(startDate + 'T00:00:00Z');
    if (Number.isNaN(start.getTime()))
        return null;
    const days = duration && duration > 0 ? duration : 1;
    return new Date(start.getTime() + (days - 1) * 86400000);
}
function shipWeekLabel(startDate, duration) {
    const end = iterationEnd(startDate, duration);
    if (!end)
        return '';
    const month = end.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    return `${month} ${end.getUTCDate()} Release`;
}
// Decode the handful of HTML entities GitHub sometimes returns in bodies
// so the inline description reads naturally.
function decodeEntities(text) {
    return text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}
// Parse owner/repo from a REST `repository_url` so a card click can address
// the issue (owner/repo/number) for the detail modal.
function ownerRepo(item) {
    // The Copilot MCP item shape varies — owner/repo may live in an API
    // `repository_url` (…/repos/OWNER/REPO) or only in a web `html_url`
    // (github.com/OWNER/REPO/…). Try every URL field and both patterns.
    const c = item.content ?? {};
    for (const u of [c.repository_url, c.html_url, c.url, item.url]) {
        const s = str(u);
        const m = s.match(/repos\/([^/]+)\/([^/]+)/) || s.match(/github\.com\/([^/]+)\/([^/]+?)(?:\/|$)/);
        if (m)
            return { owner: m[1], repo: m[2] };
    }
    return { owner: '', repo: '' };
}
// Normalise project items into release-week columns for the board layout:
//   { columns: [{ id, label, count, items: BoardItem[] }, …], total }
// Items with no iteration land in a trailing "No date yet" column.
const board_data = (args) => {
    const rawItems = extractItems(args.value);
    const UNSCHEDULED = '__unscheduled__';
    const cols = new Map();
    for (const raw of rawItems) {
        const status = itemStatus(raw);
        // Exclude shipped work — the board shows what's still upcoming/in flight.
        if (/^(done|closed)$/i.test(status.trim()))
            continue;
        const colId = itemIterationId(raw) || UNSCHEDULED;
        if (!cols.has(colId)) {
            if (colId === UNSCHEDULED) {
                cols.set(colId, { id: colId, label: 'No date yet', shipDate: '9999-12-31', items: [] });
            }
            else {
                const v = restFieldValue(raw, { dataType: 'iteration' });
                const iv = v && typeof v === 'object' ? v : {};
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
        const number = typeof raw.number === 'number'
            ? raw.number
            : typeof raw.content?.number === 'number'
                ? raw.content.number
                : null;
        const title = str(raw.title) || str(raw.content?.title) || (number != null ? `#${number}` : '');
        const { owner, repo } = ownerRepo(raw);
        cols.get(colId).items.push({
            id: str(raw.id) || (number != null ? `i${number}` : title),
            number,
            owner,
            repo,
            label: cleanLabel(title) || title,
            body: decodeEntities(str(raw.content?.body)),
            status,
            statusTone: gantt_status_tone({ value: status }) || 'accent',
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
const elements = {
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
