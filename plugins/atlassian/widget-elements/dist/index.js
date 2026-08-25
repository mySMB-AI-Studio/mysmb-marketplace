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
function classifyRequest(request) {
    const cycle = findResolutionCycle(request);
    if (cycle?.breached === true)
        return 'alerts';
    if (cycle && isAtRisk(cycle))
        return 'behind';
    const category = normalizeCategory(request?.currentStatus?.statusCategory);
    if (category === 'NEW')
        return 'new';
    return 'in_progress';
}
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
const elements = {
    slug: 'atlassian',
    functions: {
        sla_tone,
        sla_label,
        request_bucket,
        bucket_count,
        filter_by_bucket,
        bucket_tone,
        sla_pct_label,
    },
    actions: {
        check_sla_this_month,
    },
};
export default elements;
