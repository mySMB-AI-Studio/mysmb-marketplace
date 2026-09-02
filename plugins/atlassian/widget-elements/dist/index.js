function hasOngoingCycle(v) {
    return !!v && typeof v === 'object' && v.ongoingCycle != null;
}
/**
 * Pick the single most-urgent RUNNING SLA clock out of a request's
 * `sla.values` array. A request commonly has 2-3 clocks running at once
 * (first-response + resolution, say) -- a queue-style tile needs exactly
 * one per row, not all of them.
 *
 * Rules: any clock with `ongoingCycle.breached === true` wins outright,
 * regardless of time math (a breached clock is always the most urgent
 * thing on the ticket). Among the rest, the clock with the soonest
 * `remainingTime.millis` wins. Clocks with no `ongoingCycle` key at all
 * (not yet started) are ignored entirely. Returns null when nothing is
 * running -- e.g. every SLA on this request is already complete or the
 * request type has no SLA policy configured (`sla` omitted upstream).
 */
function pickUrgentClock(values) {
    if (!Array.isArray(values))
        return null;
    const active = values.filter(hasOngoingCycle);
    if (active.length === 0)
        return null;
    const breached = active.filter((v) => v.ongoingCycle.breached === true);
    const pool = breached.length > 0 ? breached : active;
    let best = pool[0];
    let bestMs = Number(best.ongoingCycle.remainingTime?.millis);
    for (const v of pool.slice(1)) {
        const ms = Number(v.ongoingCycle.remainingTime?.millis);
        if (Number.isFinite(ms) && (!Number.isFinite(bestMs) || ms < bestMs)) {
            best = v;
            bestMs = ms;
        }
    }
    return best;
}
// "At risk" cutoff for a clock that hasn't breached yet: under 15% of its
// total goal duration remaining, or under a flat 1 hour when goalDuration
// itself is missing (defensive -- shouldn't happen if breached/remainingTime
// are present, but a threshold with nothing to compare against shouldn't
// throw or silently read as "never at risk").
const AT_RISK_FRACTION = 0.15;
const AT_RISK_FALLBACK_MS = 60 * 60 * 1000;
function isAtRisk(cycle) {
    const remainingMs = Number(cycle.remainingTime?.millis);
    if (!Number.isFinite(remainingMs))
        return false;
    const goalMs = Number(cycle.goalDuration?.millis);
    const threshold = Number.isFinite(goalMs) && goalMs > 0 ? goalMs * AT_RISK_FRACTION : AT_RISK_FALLBACK_MS;
    return remainingMs <= threshold;
}
/**
 * Urgency tone for a JSM request's most-urgent running SLA clock, per
 * TILE-DISPLAY-STANDARDS.md's status-tone model: `destructive` (breached),
 * `warning` (running low -- under 15% of goal duration remaining, or under
 * 1h when goalDuration is missing), or `muted` (comfortable, or no clock
 * running at all). "success" doesn't apply here -- every row in a
 * queue tile is an open request by definition of the OPEN_REQUESTS filter,
 * so nothing in this list is "done".
 *
 * Args: { values } -- a request's `sla.values` array. May be undefined:
 * JSM omits `sla` entirely when the request type has no SLA policy.
 *
 * Spec example:
 *   { "$computed": "atlassian_sla_tone", "args": { "values": { "$item": "sla/values" } } }
 */
const sla_tone = (args) => {
    const clock = pickUrgentClock(args.values);
    if (!clock)
        return 'muted';
    if (clock.ongoingCycle.breached === true)
        return 'destructive';
    return isAtRisk(clock.ongoingCycle) ? 'warning' : 'muted';
};
// Fallback formatter, used only if Atlassian's own `remainingTime.friendly`
// is ever missing on a clock that IS running (shouldn't happen in practice).
function formatMillis(ms) {
    const abs = Math.abs(ms);
    const h = Math.floor(abs / 3_600_000);
    const m = Math.round((abs % 3_600_000) / 60_000);
    if (h === 0)
        return `${m}m`;
    if (m === 0)
        return `${h}h`;
    return `${h}h ${m}m`;
}
/**
 * Display label for a JSM request's most-urgent running SLA clock --
 * "Breached", Atlassian's own pre-formatted `remainingTime.friendly`
 * string (e.g. "45m"), or "No active SLA" when nothing is running (no
 * clock has an `ongoingCycle` at all -- every SLA already completed/
 * paused, or the request type has no SLA policy). Deliberately does NOT
 * re-derive or decorate Atlassian's own friendly string -- same "use the
 * vendor's own pre-formatted time string as-is" rule this plugin already
 * follows for Confluence's `friendlyLastModified` (its exact phrasing
 * wasn't independently verified, so don't guess at reformatting it).
 *
 * Args: { values } -- a request's `sla.values` array.
 *
 * Spec example:
 *   { "$computed": "atlassian_sla_label", "args": { "values": { "$item": "sla/values" } } }
 */
const sla_label = (args) => {
    const clock = pickUrgentClock(args.values);
    if (!clock)
        return 'No active SLA';
    const cycle = clock.ongoingCycle;
    if (cycle.breached === true)
        return 'Breached';
    if (cycle.remainingTime?.friendly)
        return cycle.remainingTime.friendly;
    const ms = Number(cycle.remainingTime?.millis);
    return Number.isFinite(ms) ? formatMillis(ms) : 'No active SLA';
};
function normalizeCategory(v) {
    return typeof v === 'string' ? v.trim().toUpperCase() : '';
}
// The "Time to resolution" clock specifically -- NOT first-response, NOT
// close-after-resolution. Matched by name, case-insensitively, since
// Atlassian returns it as a plain display string on `sla.values[].name`.
function findResolutionCycle(request) {
    const values = request?.sla?.values;
    if (!Array.isArray(values))
        return undefined;
    const match = values.find((v) => v &&
        typeof v === 'object' &&
        typeof v.name === 'string' &&
        v.name.trim().toLowerCase() === 'time to resolution');
    return match?.ongoingCycle;
}
// Real, confirmed-live gotcha: `list_service_desk_requests`'s own
// `request_status: "OPEN_REQUESTS"` server-side filter does NOT reliably
// exclude requests whose Jira status has moved to a DONE-category status
// (e.g. "Resolved") -- confirmed by resolving a real sandbox ticket and
// seeing it still come back in an OPEN_REQUESTS-filtered response. Rather
// than trust that param alone, classify DONE-category requests explicitly
// and exclude them from every bucket, checked BEFORE the SLA-urgency
// checks below (a resolved ticket's SLA data shouldn't matter either way).
//
// New vs In Progress, per stakeholder direction (not `statusCategory ===
// "NEW"` -- confirmed structurally unreachable on this workflow, see the
// widget's own description): New = genuinely UNASSIGNED (the `unassigned`
// field from `list_service_desk_requests`, only present when the tool was
// called with `project_key`); In Progress = assigned. `unassigned` may be
// `undefined` if the tile's dataProvider omits `project_key` -- treated as
// "not new" (falls through to in_progress) rather than crashing, so this
// stays backward compatible with the param being optional server-side.
function classifyRequest(request) {
    const req = request;
    const category = normalizeCategory(req?.currentStatus?.statusCategory);
    if (category === 'DONE')
        return 'done';
    const cycle = findResolutionCycle(request);
    if (cycle?.breached === true)
        return 'alerts';
    if (cycle && isAtRisk(cycle))
        return 'behind';
    if (req?.unassigned === true)
        return 'new';
    return 'in_progress';
}
/**
 * Count requests that are genuinely still active (excludes 'done' --
 * see the `classifyRequest` note above about `OPEN_REQUESTS` unreliably
 * including resolved/closed requests). Used for the header's "N open
 * requests" eyebrow instead of a raw `count` over the full response.
 *
 * Args: { values } -- the request array.
 *
 * Spec example:
 *   { "$computed": "atlassian_active_request_count", "args": { "values": { "$state": "..." } } }
 */
const active_request_count = (args) => {
    const values = Array.isArray(args.values) ? args.values : [];
    return values.filter((v) => classifyRequest(v) !== 'done').length;
};
const request_bucket = (args) => classifyRequest(args.request);
/**
 * Count how many requests in a list fall into one bucket. Used for the
 * four stat-card counts and the header "breached" counter (bucket
 * "alerts").
 *
 * Args: { values, bucket } -- `values` is the request array (e.g.
 * `/atlassian/list_service_desk_requests/values`), `bucket` one of
 * 'new' | 'in_progress' | 'behind' | 'alerts'.
 *
 * Spec example:
 *   { "$computed": "atlassian_bucket_count", "args": { "values": { "$state": "..." }, "bucket": "alerts" } }
 */
const bucket_count = (args) => {
    const values = Array.isArray(args.values) ? args.values : [];
    const bucket = args.bucket;
    return values.filter((v) => classifyRequest(v) === bucket).length;
};
/**
 * Filter a request list down to the ones in one bucket. Used to pre-compute
 * `/ui/filteredRequests` via a `watch`-driven `setState` (see this widget's
 * `card.watch`), NOT via a per-row `visible` check on the repeated row --
 * this renderer's `visible`/`$cond` condition grammar only recognizes
 * `$state`/`$item`/`$index` as the primary operand key (confirmed live in
 * the tile harness: a `$computed`-keyed condition, with or without a
 * comparator, always evaluates as absent/falsy -- RULE 5.9 in
 * `myHubV2/architecture/technical/mobile-widget-interpreter.md`). Filtering
 * the array up front and pointing `repeat.statePath` at the result sidesteps
 * that limitation entirely.
 *
 * Args: { values, bucket } -- same shape as `atlassian_bucket_count`.
 *
 * Spec example:
 *   { "$computed": "atlassian_filter_by_bucket", "args": { "values": {...}, "bucket": {...} } }
 */
const filter_by_bucket = (args) => {
    const values = Array.isArray(args.values) ? args.values : [];
    const bucket = args.bucket;
    return values.filter((v) => classifyRequest(v) === bucket);
};
/**
 * Tone for a bucket-count-driven indicator (e.g. the header "breached"
 * badge): 'destructive' when the count is > 0, 'muted' when it's 0.
 * Exists as its own direct-return function -- NOT a `$cond` wrapping
 * `atlassian_bucket_count` with a comparator -- for the same RULE 5.9
 * reason documented on `atlassian_filter_by_bucket` above: `$cond`'s
 * condition is evaluated through the identical `visible` grammar, so a
 * `$computed`-keyed condition there is silently always-false too. A
 * `$computed` used directly as a prop's VALUE (no comparator, no
 * `$cond`) is unaffected -- that path just resolves and returns.
 *
 * Args: { values, bucket } -- same shape as `atlassian_bucket_count`.
 *
 * Spec example:
 *   { "$computed": "atlassian_bucket_tone", "args": { "values": {...}, "bucket": "alerts" } }
 */
const bucket_tone = (args) => {
    const values = Array.isArray(args.values) ? args.values : [];
    const bucket = args.bucket;
    const count = values.filter((v) => classifyRequest(v) === bucket).length;
    return count > 0 ? 'destructive' : 'muted';
};
async function callAtlassianTool(tool, params) {
    try {
        const res = await fetch('/api/widgets-system/call-tool', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ mcp: 'atlassian', tool, params }),
        });
        if (!res.ok) {
            const text = await res.text().catch(() => res.statusText);
            return { ok: false, error: text || `HTTP ${res.status}` };
        }
        const body = (await res.json());
        return { ok: true, data: body.data };
    }
    catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}
// search_issues's max_results cap is 100 (enforced server-side too) -- this
// is also our N+1 ceiling: one search call + at most this many
// `get_request_sla` calls. Deliberately conservative; a higher cap makes
// every click slower without changing the metric's usefulness much.
const DEFAULT_TICKET_CAP = 100;
const MAX_TICKET_CAP = 100;
/**
 * Deliberately NOT `zod` here, even though it's on the widget-elements
 * import allowlist. The compiled `dist/index.js` this file becomes is
 * streamed to the browser completely VERBATIM -- no bundling, no import map
 * (see myHubV2's `apps/web/src/app/api/widget-elements/file/route.ts`, a
 * plain `fs.readFile` -> `Response`) -- and then loaded with a plain browser
 * `import()`. Confirmed live in the tile harness: a bare `import ... from
 * "zod"` throws `Failed to resolve module specifier "zod"` at module-
 * evaluation time, and because ES module imports are all-or-nothing, that
 * fails the ENTIRE module load -- every function this plugin already ships
 * (`atlassian_bucket_count`, `atlassian_sla_tone`, etc.) silently stops
 * resolving too, not just this new action. The same latent bug already
 * exists independently in `xero-projects`'s committed `dist/index.js`
 * (confirmed the same way) -- pre-existing, unrelated to this branch, out
 * of scope to fix here, but real: the allowlist documents `zod` as
 * permitted, but nothing in the runtime actually resolves it. Hand-rolled,
 * dependency-free validation below instead.
 *
 * `project_key` is the JQL project key for this service desk (e.g. "SUP"),
 * NOT the `service_desk_id` used elsewhere on this tile -- JQL's `project =`
 * clause needs the project key/id, and there is no cheap way to resolve one
 * from the other at click-time without an extra `list_service_desks`
 * round-trip. Same "widget can't chain a lookup call" limitation already
 * documented for `service_desk_id` on this tile -- passed as a hardcoded
 * per-tenant action param instead, and must be updated together with
 * `service_desk_id` when this widget is pointed at a different tenant.
 * `max_checked` optionally overrides the resolved-ticket cap, clamped to
 * [1, 100].
 */
const checkSlaParamsSchema = {
    type: 'object',
    properties: {
        project_key: { type: 'string', minLength: 1 },
        max_checked: { type: 'integer', minimum: 1, maximum: MAX_TICKET_CAP },
    },
    required: ['project_key'],
};
function parseCheckSlaParams(params) {
    const projectKey = typeof params.project_key === 'string' ? params.project_key.trim() : '';
    if (!projectKey)
        return null;
    const rawCap = Number(params.max_checked);
    const cap = Number.isFinite(rawCap)
        ? Math.min(MAX_TICKET_CAP, Math.max(1, Math.trunc(rawCap)))
        : DEFAULT_TICKET_CAP;
    return { projectKey, cap };
}
function findFirstResponseCycles(data) {
    const values = data?.values;
    if (!Array.isArray(values))
        return null;
    const match = values.find((v) => typeof v?.name === 'string' && v.name.trim().toLowerCase() === 'time to first response');
    return Array.isArray(match?.completedCycles) ? match.completedCycles : null;
}
/**
 * "Check SLA % this month" click handler. First-response SLA compliance over
 * tickets RESOLVED in the current calendar month for one service desk's
 * project: for each resolved ticket, look up its "Time to first response"
 * SLA and check whether any `completedCycles` entry has `breached: true`.
 * Percentage = (tickets with a non-breached first-response cycle) / (tickets
 * with ANY completed first-response cycle) x 100 -- a ticket whose SLA has
 * no completed first-response cycle at all (e.g. no SLA policy on that
 * request type) is EXCLUDED from both numerator and denominator rather than
 * guessed at, matching this connector's existing "exclude, don't guess"
 * policy for missing SLA data.
 *
 * Cost control: `search_issues`'s JQL orders resolved tickets most-recent
 * first and is capped (default 100, `search_issues`'s own server-side max).
 * If more resolved tickets exist than the cap (`isLast === false` on the
 * search response), the result discloses that plainly instead of silently
 * presenting a partial number as complete -- e.g. "94% (last 100 resolved
 * this month -- more exist)". Note: Jira's current search endpoint
 * (`POST /rest/api/3/search/jql`) does not return a total match count
 * (Atlassian dropped it deliberately when replacing the old endpoint), so
 * this can say "more exist" but can't cheaply say exactly how many -- doing
 * that would need a second, expensive full-count query, defeating the
 * purpose of the cap.
 *
 * KNOWN LIMITATION, confirmed live: this query relies on Jira's real
 * `resolutiondate` field, which is only populated when a workflow
 * transition actually sets a Resolution (not just a status whose NAME
 * looks like "Resolved"). Confirmed on the sandbox: a ticket manually
 * moved to a "Resolved"-named, DONE-category status still had
 * `resolution: null` / `resolutiondate: null` on the underlying Jira
 * issue, because that transition's screen has no Resolution field --
 * so this query correctly finds zero matches for it, even though the
 * ticket visually looks resolved. This is a real per-customer workflow-
 * configuration gap (same class as the "New" bucket limitation
 * documented on the Service Desk Queue widget), not a bug in this query
 * -- `resolutiondate` IS the correct, standard Jira signal for "when was
 * this actually resolved." Left as-is deliberately rather than falling
 * back to a looser signal like `updated`, which would conflate "resolved"
 * with "edited for any reason."
 *
 * State written (all widget-local):
 *   /ui/slaLoading    -- true while a run is in flight
 *   /ui/slaRunToken   -- monotonic guard value; a click that starts after
 *                        this one bumps it, so a lagging response from an
 *                        earlier (superseded) click is dropped on arrival
 *                        instead of overwriting a newer result
 *   /ui/slaResult     -- null until a run completes; then the display
 *                        string (percentage, "no resolved tickets", or an
 *                        error message)
 *
 * Args: { project_key, max_checked? } -- see `checkSlaSchema` above.
 *
 * Spec example:
 *   { "action": "atlassian_check_sla_this_month",
 *     "params": { "project_key": "SUP" } }
 */
async function checkSlaThisMonth(params, ctx) {
    const store = ctx.store;
    if (!store)
        return;
    // Ignore a click while a run is already in flight -- the button is also
    // disabled automatically during this (the renderer tracks any pending
    // action-handler promise per action name), but a handler-level guard
    // means this is correct even if something else re-fires the action.
    if (store.get('/ui/slaLoading') === true)
        return;
    const parsed = parseCheckSlaParams(params);
    if (!parsed) {
        store.set('/ui/slaResult', 'Could not check SLA % (missing project key).');
        return;
    }
    const { projectKey, cap } = parsed;
    // Monotonic run token: bumped at the start of THIS run. Any await below
    // checks it's still current before touching state, so a superseded run
    // (the widget re-fired this action, or -- in a host that unmounts/reuses
    // this store -- moved on) can't clobber a newer one's result.
    const runToken = Date.now() + Math.random();
    store.set('/ui/slaRunToken', runToken);
    store.set('/ui/slaLoading', true);
    store.set('/ui/slaResult', null);
    const stale = () => store.get('/ui/slaRunToken') !== runToken;
    try {
        const jql = `project = ${projectKey} AND resolutiondate >= startOfMonth() AND resolutiondate <= now() ORDER BY resolutiondate DESC`;
        const searchRes = await callAtlassianTool('search_issues', {
            jql,
            max_results: cap,
            fields: ['summary'],
        });
        if (stale())
            return;
        if (!searchRes.ok) {
            store.set('/ui/slaResult', `Could not check SLA % (${searchRes.error ?? 'search failed'}).`);
            return;
        }
        const searchData = searchRes.data;
        const issues = Array.isArray(searchData?.issues) ? searchData.issues : [];
        const truncated = searchData?.isLast === false;
        if (issues.length === 0) {
            store.set('/ui/slaResult', 'No resolved tickets this month yet.');
            return;
        }
        let eligible = 0;
        let compliant = 0;
        for (const issue of issues) {
            if (stale())
                return;
            const key = issue.key;
            if (typeof key !== 'string' || !key)
                continue;
            const slaRes = await callAtlassianTool('get_request_sla', { issue_id_or_key: key });
            if (stale())
                return;
            if (!slaRes.ok)
                continue; // best-effort: skip tickets whose SLA lookup itself fails
            const cycles = findFirstResponseCycles(slaRes.data);
            if (!cycles || cycles.length === 0)
                continue; // no completed first-response cycle -> excluded, not guessed
            eligible += 1;
            if (!cycles.some((c) => c.breached === true))
                compliant += 1;
        }
        if (stale())
            return;
        if (eligible === 0) {
            store.set('/ui/slaResult', 'No first-response SLA data for tickets resolved this month.');
            return;
        }
        const pct = Math.round((compliant / eligible) * 100);
        const suffix = truncated
            ? ` (last ${issues.length} resolved this month — more exist)`
            : ` (${eligible} resolved this month)`;
        store.set('/ui/slaResult', `${pct}%${suffix}`);
    }
    catch (err) {
        if (!stale()) {
            store.set('/ui/slaResult', 'Could not check SLA % this month.');
        }
    }
    finally {
        if (!stale())
            store.set('/ui/slaLoading', false);
    }
}
const check_sla_this_month = {
    description: 'Compute first-response SLA compliance for tickets resolved this month in one JSM service desk\'s ' +
        'project. On-demand only (never runs automatically) -- fetches via a JQL search plus one SLA lookup ' +
        'per resolved ticket, capped at 100 tickets, most-recent first.',
    schema: checkSlaParamsSchema,
    handler: checkSlaThisMonth,
};
/**
 * Button label for the "SLA % this month" action -- the computed result
 * once a run has completed, or the initial call-to-action text before the
 * first click. Kept as a direct-return `$computed` (no `$cond`) per this
 * file's established RULE 5.9 workaround: a `$cond` keyed on anything other
 * than `$state`/`$item`/`$index` silently evaluates as absent, but a
 * `$computed` used directly as a prop's value is unaffected.
 *
 * Args: { result } -- `/ui/slaResult` (null/absent before the first click
 * completes).
 *
 * Spec example:
 *   { "$computed": "atlassian_sla_pct_label", "args": { "result": { "$state": "/ui/slaResult" } } }
 */
const sla_pct_label = (args) => {
    const result = args.result;
    return typeof result === 'string' && result.length > 0 ? result : 'Check SLA % this month';
};
function normalizePriorityName(v) {
    return typeof v === 'string' ? v.trim().toLowerCase() : '';
}
/**
 * Args: { value } -- a Jira issue's `fields.priority.name` (may be
 * undefined -- some issue types/screens have no priority field at all).
 *
 * Spec example:
 *   { "$computed": "atlassian_priority_tone", "args": { "value": { "$item": "fields/priority/name" } } }
 */
const priority_tone = (args) => {
    const name = normalizePriorityName(args.value);
    if (name === 'highest')
        return 'destructive';
    if (name === 'high')
        return 'warning';
    return 'muted'; // medium / low / lowest / unset
};
/**
 * Display label for a Jira issue's priority. Jira's own `name` is already
 * Title Case on the default scheme ("Highest", "High", ...), but this still
 * goes through a dedicated `$computed` rather than a raw pass-through --
 * per TILE-DISPLAY-STANDARDS.md §3, no connector enum reaches a badge/label
 * without a normalizing helper, and this is the one place to fix casing if
 * a customized site's priority scheme ever isn't Title Case. Falls back to
 * "No priority" when the field is absent (undefined/null/empty), rather
 * than rendering a blank label.
 *
 * Args: { value } -- a Jira issue's `fields.priority.name`.
 *
 * Spec example:
 *   { "$computed": "atlassian_priority_label", "args": { "value": { "$item": "fields/priority/name" } } }
 */
const priority_label = (args) => {
    const raw = typeof args.value === 'string' ? args.value.trim() : '';
    if (!raw)
        return 'No priority';
    return raw.replace(/\S+/g, (word) => word[0].toUpperCase() + word.slice(1).toLowerCase());
};
/**
 * Display name for a Jira `fields.assignee`/`fields.reporter` person object
 * -- `null` for an unassigned issue's `assignee` is a normal, common case
 * (not a data error), so this returns "Unassigned" rather than a blank
 * value or crashing on `null.displayName`. `reporter` is effectively never
 * null on a real Jira issue, but the same fallback covers it defensively
 * without needing a second, near-identical helper.
 *
 * Args: { person } -- a Jira person object (or null/undefined).
 *
 * Spec example:
 *   { "$computed": "atlassian_display_name", "args": { "person": { "$item": "fields/assignee" } } }
 */
const display_name = (args) => {
    const person = args.person;
    return person?.displayName?.trim() || 'Unassigned';
};
/**
 * "Open in Jira" destination for the Open Service Requests tile's detail
 * overlay. Originally built a per-tenant deep link
 * (`{site_url}/browse/{key}`), since `search_issues`'s response has no
 * ready-made browsable link (its `self` field is an API URL, not the
 * customer's `*.atlassian.net` site domain) and a widget's `dataProvider`
 * fires exactly one MCP tool call on mount, so it can't chain a
 * `list_sites` lookup first to resolve the real domain. That meant
 * `site_url` was a hardcoded literal pointed at one sandbox -- correct only
 * for that one tenant, silently WRONG for every other tenant this tile
 * ships to, with no way to catch the mistake before a user hit a dead/
 * mismatched site. Deliberately downgraded to a fixed, tenant-agnostic
 * link instead: always correct, at the cost of one extra manual step.
 *
 * Points at `https://home.atlassian.com` -- Atlassian's real cross-site
 * entry point, works for any logged-in user regardless of which site
 * they're on. The overlay already shows the issue key in its subtitle
 * (`ovSubtitle` / `/ui/sel/key`), so the user has what they need to jump
 * straight to the ticket via Jira's own global search (the key is
 * recognized directly, no manual lookup needed).
 *
 * Revisit if/when a server-side fix lands (the MCP server resolving and
 * returning the real site domain as part of `search_issues`'s response,
 * rather than a widget trying to chain a second call) -- see
 * `list_sites`/`service_desk_id` discussion on the Service Desk Queue tile
 * for the same underlying platform gap.
 *
 * Spec example:
 *   { "$computed": "atlassian_issue_url", "args": {} }
 */
const issue_url = () => 'https://home.atlassian.com';
/**
 * Per-agent workload breakdown for the Jira Workload tile (WorkQ ticket:
 * "Tile: Jira Workload" -- same data points as Jira's own native Workload
 * report: Agent, Work Items In Progress). Jira's Workload report is itself
 * scoped to one project (not site-wide), so this tile's `dataProvider`
 * always passes an explicit `project_key` in its JQL -- same "must be
 * passed explicitly, no auto-resolution" limitation already documented for
 * `service_desk_id`/`project_key` on this plugin's Service Desk Queue tile
 * and the "SLA % this month" action above.
 *
 * Takes the raw `issues` array from `search_issues` (called with
 * `fields: ["assignee"]`, JQL `project = <key> AND statusCategory =
 * "In Progress"`) and groups by `fields.assignee.accountId`, counting one
 * "work item in progress" per issue. Two exclusions, both per the ticket's
 * explicit ask to count only human agents:
 *
 * 1. Unassigned issues (`fields.assignee` is `null`) -- confirmed real and
 *    common on a live sandbox response, not an edge case. Excluded
 *    entirely: an unassigned item doesn't belong to anyone's workload.
 * 2. Non-human assignees, filtered via `accountType !== "atlassian"`.
 *    Confirmed against Atlassian's own Jira Cloud Platform REST API v3
 *    User resource docs: `accountType` is one of `"atlassian"` (a real,
 *    licensed human user -- what this tile wants), `"app"` (a Connect/
 *    Forge app or automation-installed account), or `"customer"` (a
 *    JSM-only customer account, not a work-assigning agent). Only
 *    `"atlassian"` passes the filter.
 *
 * **UNTESTED against a live non-"atlassian" example -- flagged deliberately,
 * not glossed over.** The sandbox used to build this tile has an
 * "Automatic" account that appears cosmetically in Jira's assignee-picker
 * dropdown but could not actually be assigned through that UI (selecting it
 * silently reverted to Unassigned), so there was no way to produce a real
 * issue assigned to a non-human account to confirm this filter's `!==
 * "atlassian"` branch against live data -- only the "real human, accountType
 * `atlassian`" path (Sean Baker / Jeric Ballesteros on KAN-1..3) was
 * confirmed live. The filter itself is built straight from Atlassian's
 * documented enum, not guessed. One more reason for caution, surfaced by a
 * 2019 Atlassian Developer Community report (`accountType` returning
 * `"atlassian"` for some app/addon accounts instead of the documented
 * `"app"`, tracked as ACJIRA-1903) -- unconfirmed whether that bug is still
 * live today, but it means this filter could in principle under-exclude a
 * misreported bot account on some sites. Re-verify against a real non-human
 * assignee before treating the exclusion path as proven, not just
 * documented.
 *
 * Sorted most-work-items-first (descending count) -- surfaces whoever's
 * busiest, matching the ticket's implicit intent -- and capped at 20 rows
 * per `TILE-DISPLAY-STANDARDS.md` §11 (won't realistically be hit for one
 * project's agent roster, but kept consistent with the standard anyway).
 *
 * Args: { issues, site_url, project_key } -- `issues` is the `search_issues`
 * response's `issues` array (e.g. `/atlassian/search_issues/issues`).
 * `site_url`/`project_key` are plain literal strings (not API-derived) used
 * to build each row's click-through `searchUrl` -- see `buildAgentSearchUrl`.
 *
 * Spec example:
 *   { "$computed": "atlassian_workload_by_agent",
 *     "args": {
 *       "issues": { "$state": "/atlassian/search_issues/issues" },
 *       "site_url": "https://mysmb.atlassian.net",
 *       "project_key": "KAN"
 *     } }
 */
const WORKLOAD_ROW_CAP = 20;
/**
 * Row click-through target: Jira Cloud's standard issue-navigator URL
 * (`https://<site>/issues/?jql=...`), pre-filtered to that agent's own
 * in-progress work in this project. Built here (not at click time) since
 * a `Table`'s `rowAction.fromRow` can only pull an already-resolved field
 * off the row -- it can't run a `$computed` itself, so the full URL has to
 * already exist on each row by the time the table renders.
 *
 * `siteUrl`/`projectKey` are plain args (not derived from the API
 * response) -- same "must be passed explicitly, hardcoded to the sandbox
 * until configured per tenant" limitation already accepted for this
 * widget's own `project_key` and every other `service_desk_id`/
 * `project_key` param elsewhere in this connector.
 */
function buildAgentSearchUrl(siteUrl, projectKey, accountId) {
    if (!siteUrl || !projectKey || !accountId)
        return '';
    const jql = `assignee = "${accountId}" AND project = ${projectKey} AND statusCategory = "In Progress"`;
    return `${siteUrl.replace(/\/+$/, '')}/issues/?jql=${encodeURIComponent(jql)}`;
}
const workload_by_agent = (args) => {
    const issues = Array.isArray(args.issues) ? args.issues : [];
    const siteUrl = typeof args.site_url === 'string' ? args.site_url : '';
    const projectKey = typeof args.project_key === 'string' ? args.project_key : '';
    const byAccount = new Map();
    for (const raw of issues) {
        const assignee = raw?.fields?.assignee;
        if (!assignee || typeof assignee !== 'object')
            continue; // unassigned -- excluded, not counted
        if (assignee.accountType !== 'atlassian')
            continue; // non-human (app/customer/other) -- excluded
        const accountId = typeof assignee.accountId === 'string' ? assignee.accountId.trim() : '';
        if (!accountId)
            continue; // can't group without a stable key
        const displayName = typeof assignee.displayName === 'string' && assignee.displayName.trim()
            ? assignee.displayName.trim()
            : 'Unknown agent';
        const existing = byAccount.get(accountId);
        if (existing) {
            existing.count += 1;
        }
        else {
            byAccount.set(accountId, {
                accountId,
                displayName,
                count: 1,
                searchUrl: buildAgentSearchUrl(siteUrl, projectKey, accountId),
            });
        }
    }
    return Array.from(byAccount.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, WORKLOAD_ROW_CAP);
};
const elements = {
    slug: 'atlassian',
    functions: {
        sla_tone,
        sla_label,
        request_bucket,
        bucket_count,
        filter_by_bucket,
        bucket_tone,
        active_request_count,
        sla_pct_label,
        priority_tone,
        priority_label,
        display_name,
        issue_url,
        workload_by_agent,
    },
    actions: {
        check_sla_this_month,
    },
};
export default elements;
