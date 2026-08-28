import type { ComputedFunction, PluginElementsModule, PluginWidgetActionContext } from './types';

/**
 * Jira Service Management SLA helpers.
 *
 * A JSM request's `sla.values` array holds one "clock" per configured SLA
 * (e.g. "Time to first response", "Time to resolution", "Time to close
 * after resolution"), each shaped like:
 *
 *   {
 *     id, name, completedCycles: [...],
 *     ongoingCycle?: {
 *       breached, paused,
 *       breachTime:    { friendly },
 *       goalDuration:  { friendly, millis },
 *       elapsedTime:   { friendly, millis },
 *       remainingTime: { friendly, millis },
 *     },
 *   }
 *
 * Confirmed against a real live response: a clock that simply hasn't
 * started yet (e.g. "Time to close after resolution" before the ticket is
 * resolved) omits the `ongoingCycle` key ENTIRELY — it is not present-but-
 * falsy. Both helpers below must treat "no ongoingCycle key" as "not
 * running" rather than crashing or reading `undefined.breached`.
 */

interface SlaCycle {
  breached?: boolean;
  paused?: boolean;
  breachTime?: { friendly?: string };
  goalDuration?: { friendly?: string; millis?: number };
  elapsedTime?: { friendly?: string; millis?: number };
  remainingTime?: { friendly?: string; millis?: number };
}

interface SlaValue {
  id?: string;
  name?: string;
  completedCycles?: unknown[];
  ongoingCycle?: SlaCycle;
}

function hasOngoingCycle(v: unknown): v is SlaValue & { ongoingCycle: SlaCycle } {
  return !!v && typeof v === 'object' && (v as SlaValue).ongoingCycle != null;
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
function pickUrgentClock(values: unknown): (SlaValue & { ongoingCycle: SlaCycle }) | null {
  if (!Array.isArray(values)) return null;
  const active = values.filter(hasOngoingCycle);
  if (active.length === 0) return null;

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

function isAtRisk(cycle: SlaCycle): boolean {
  const remainingMs = Number(cycle.remainingTime?.millis);
  if (!Number.isFinite(remainingMs)) return false;
  const goalMs = Number(cycle.goalDuration?.millis);
  const threshold =
    Number.isFinite(goalMs) && goalMs > 0 ? goalMs * AT_RISK_FRACTION : AT_RISK_FALLBACK_MS;
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
const sla_tone: ComputedFunction = (args) => {
  const clock = pickUrgentClock(args.values);
  if (!clock) return 'muted';
  if (clock.ongoingCycle.breached === true) return 'destructive';
  return isAtRisk(clock.ongoingCycle) ? 'warning' : 'muted';
};

// Fallback formatter, used only if Atlassian's own `remainingTime.friendly`
// is ever missing on a clock that IS running (shouldn't happen in practice).
function formatMillis(ms: number): string {
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3_600_000);
  const m = Math.round((abs % 3_600_000) / 60_000);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
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
const sla_label: ComputedFunction = (args) => {
  const clock = pickUrgentClock(args.values);
  if (!clock) return 'No active SLA';
  const cycle = clock.ongoingCycle;
  if (cycle.breached === true) return 'Breached';
  if (cycle.remainingTime?.friendly) return cycle.remainingTime.friendly;
  const ms = Number(cycle.remainingTime?.millis);
  return Number.isFinite(ms) ? formatMillis(ms) : 'No active SLA';
};

/**
 * Queue-bucket classification for the Service Desk Queue tile's redesign
 * (Tile: Service Desk Queue - JSM - Service Management).
 *
 * Four buckets, all derived from the SAME `list_service_desk_requests`
 * response already fetched by this widget's `dataProvider` -- no new tool
 * call. A request's bucket is a pure function of two things already on
 * every request: `currentStatus.statusCategory` and the "Time to
 * resolution" SLA clock in `sla.values`.
 *
 * `statusCategory` casing: confirmed UPPERCASE ("NEW", "INDETERMINATE",
 * "DONE") against Atlassian's own servicedeskapi request-object docs
 * (`currentStatus: { status, statusCategory: "NEW", statusDate }`), and
 * consistent with a real live sandbox sample that showed `"INDETERMINATE"`
 * for a "Waiting for support" ticket. This is a different, flatter shape
 * than the nested `fields.status.statusCategory.key` object Jira's own
 * platform issue API uses (which IS lowercase) -- don't confuse the two.
 * `normalizeCategory` upper-cases defensively regardless, so a
 * differently-cased value from a future API revision degrades to
 * "in_progress" instead of silently mis-bucketing.
 *
 * Priority order -- deliberately SLA-urgency-first, not status-first:
 *   1. alerts      -- "Time to resolution" ongoingCycle.breached === true
 *   2. behind      -- ongoingCycle exists, not breached, but at-risk
 *                     (same 15%-of-goal / 1h-fallback threshold as
 *                     atlassian_sla_tone's "warning", reused via isAtRisk)
 *   3. new         -- statusCategory === "NEW"
 *   4. in_progress -- everything else (typically "INDETERMINATE")
 *
 * Alerts/Behind are checked before New so an unactioned brand-new ticket
 * that's already close to breaching its resolution clock surfaces under
 * Behind/Alerts rather than hiding under New -- the whole point of a
 * bucket board is to not bury an urgent ticket behind a status label.
 * This also guarantees the Alerts bucket's count always equals the
 * header's "breached" counter (both are exactly "breached === true" on
 * the resolution clock, no status carve-out) -- intentional, not a bug.
 *
 * Spec example (single request -> bucket key):
 *   { "$computed": "atlassian_request_bucket", "args": { "request": { "$item": "" } } }
 */
export type RequestBucket = 'new' | 'in_progress' | 'behind' | 'alerts' | 'done';

interface JsmRequest {
  currentStatus?: { statusCategory?: string };
  sla?: { values?: unknown[] };
  unassigned?: boolean;
}

function normalizeCategory(v: unknown): string {
  return typeof v === 'string' ? v.trim().toUpperCase() : '';
}

// The "Time to resolution" clock specifically -- NOT first-response, NOT
// close-after-resolution. Matched by name, case-insensitively, since
// Atlassian returns it as a plain display string on `sla.values[].name`.
function findResolutionCycle(request: unknown): SlaCycle | undefined {
  const values = (request as JsmRequest | undefined)?.sla?.values;
  if (!Array.isArray(values)) return undefined;
  const match = values.find(
    (v) =>
      v &&
      typeof v === 'object' &&
      typeof (v as SlaValue).name === 'string' &&
      (v as SlaValue).name!.trim().toLowerCase() === 'time to resolution',
  ) as (SlaValue & { ongoingCycle?: SlaCycle }) | undefined;
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
function classifyRequest(request: unknown): RequestBucket {
  const req = request as JsmRequest | undefined;
  const category = normalizeCategory(req?.currentStatus?.statusCategory);
  if (category === 'DONE') return 'done';
  const cycle = findResolutionCycle(request);
  if (cycle?.breached === true) return 'alerts';
  if (cycle && isAtRisk(cycle)) return 'behind';
  if (req?.unassigned === true) return 'new';
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
const active_request_count: ComputedFunction = (args) => {
  const values = Array.isArray(args.values) ? args.values : [];
  return values.filter((v) => classifyRequest(v) !== 'done').length;
};

const request_bucket: ComputedFunction = (args) => classifyRequest(args.request);

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
const bucket_count: ComputedFunction = (args) => {
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
const filter_by_bucket: ComputedFunction = (args) => {
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
const bucket_tone: ComputedFunction = (args) => {
  const values = Array.isArray(args.values) ? args.values : [];
  const bucket = args.bucket;
  const count = values.filter((v) => classifyRequest(v) === bucket).length;
  return count > 0 ? 'destructive' : 'muted';
};

/**
 * "SLA % this month" — first-response SLA compliance for the Service Desk
 * Queue tile's header (Tile: Service Desk Queue - JSM - Service Management).
 * Opt-in and on-demand ONLY: this is deliberately not part of the tile's
 * `dataProvider` (which fires once, cheaply, on mount for the bucket board).
 * This metric instead needs one JQL search plus one `get_request_sla` call
 * PER resolved ticket (N+1) -- expensive enough that it must only run when a
 * user explicitly clicks the button, never automatically and never blocking
 * the tile's normal render.
 *
 * This is the marketplace's first plugin-level widget ACTION (system's
 * `expand_github_item` in myHubV2's `system/actions.ts` is the proven
 * reference for the shape: click -> loading flag on the widget's own store
 * -> on-demand tool call(s) -> store the result -> stale-response guard).
 * One mechanical detail does NOT carry over: `expand_github_item` dynamically
 * `import()`s the host's own `@/features/widgets-system/call-tool` module,
 * which only works there because that action ships INSIDE the host's own
 * Next.js bundle. A plugin's `widget-elements/dist/index.js` is fetched and
 * `import()`ed by the browser as an independent ES module from
 * `/api/plugin-elements/<slug>/index.js` -- it has no bundler alias
 * resolution, so a bare `@/...` specifier would throw at runtime, and
 * `@/lib/...`/`@myhub/*` host reach-ins are disallowed for widget-elements
 * anyway (see this plugin's authoring skill). Since no plugin-facing
 * `callTool` helper is exported on the widget-elements allowlist
 * (`react`, `lucide-react`, `zod`, `@json-render/core`, `@json-render/react`,
 * `@myhub/widget-tokens`), the only viable path is a plain same-origin
 * `fetch()` of `/api/widgets-system/call-tool` -- the EXACT endpoint and
 * `{ mcp, tool, params }` -> `{ data } | { error }` contract the host's own
 * `call-tool.ts` posts to, just invoked directly instead of through an
 * unreachable import. This is a deliberate, documented deviation from the
 * literal `expand_github_item` mechanics, not an oversight -- flagged here
 * and in this branch's build notes since this is the first plugin action
 * ever shipped in this marketplace and the pattern is worth getting right
 * for whoever writes the second one.
 */

interface CallToolResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

async function callAtlassianTool(
  tool: string,
  params: Record<string, unknown>,
): Promise<CallToolResult> {
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
    const body = (await res.json()) as { data?: unknown };
    return { ok: true, data: body.data };
  } catch (err) {
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
} as const;

function parseCheckSlaParams(
  params: Record<string, unknown>,
): { projectKey: string; cap: number } | null {
  const projectKey = typeof params.project_key === 'string' ? params.project_key.trim() : '';
  if (!projectKey) return null;
  const rawCap = Number(params.max_checked);
  const cap = Number.isFinite(rawCap)
    ? Math.min(MAX_TICKET_CAP, Math.max(1, Math.trunc(rawCap)))
    : DEFAULT_TICKET_CAP;
  return { projectKey, cap };
}

interface JiraSearchIssue {
  key?: string;
}

interface JiraSearchResponse {
  issues?: JiraSearchIssue[];
  isLast?: boolean;
}

interface SlaCompletedCycle {
  breached?: boolean;
}

interface SlaValueEntry {
  name?: string;
  completedCycles?: SlaCompletedCycle[];
}

interface RequestSlaResponse {
  values?: SlaValueEntry[];
}

function findFirstResponseCycles(data: unknown): SlaCompletedCycle[] | null {
  const values = (data as RequestSlaResponse | undefined)?.values;
  if (!Array.isArray(values)) return null;
  const match = values.find(
    (v) => typeof v?.name === 'string' && v.name.trim().toLowerCase() === 'time to first response',
  );
  return Array.isArray(match?.completedCycles) ? match!.completedCycles! : null;
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
async function checkSlaThisMonth(
  params: Record<string, unknown>,
  ctx: PluginWidgetActionContext,
): Promise<void> {
  const store = ctx.store;
  if (!store) return;

  // Ignore a click while a run is already in flight -- the button is also
  // disabled automatically during this (the renderer tracks any pending
  // action-handler promise per action name), but a handler-level guard
  // means this is correct even if something else re-fires the action.
  if (store.get('/ui/slaLoading') === true) return;

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
    if (stale()) return;

    if (!searchRes.ok) {
      store.set('/ui/slaResult', `Could not check SLA % (${searchRes.error ?? 'search failed'}).`);
      return;
    }

    const searchData = searchRes.data as JiraSearchResponse | undefined;
    const issues = Array.isArray(searchData?.issues) ? searchData!.issues! : [];
    const truncated = searchData?.isLast === false;

    if (issues.length === 0) {
      store.set('/ui/slaResult', 'No resolved tickets this month yet.');
      return;
    }

    let eligible = 0;
    let compliant = 0;
    for (const issue of issues) {
      if (stale()) return;
      const key = issue.key;
      if (typeof key !== 'string' || !key) continue;

      const slaRes = await callAtlassianTool('get_request_sla', { issue_id_or_key: key });
      if (stale()) return;
      if (!slaRes.ok) continue; // best-effort: skip tickets whose SLA lookup itself fails

      const cycles = findFirstResponseCycles(slaRes.data);
      if (!cycles || cycles.length === 0) continue; // no completed first-response cycle -> excluded, not guessed

      eligible += 1;
      if (!cycles.some((c) => c.breached === true)) compliant += 1;
    }

    if (stale()) return;

    if (eligible === 0) {
      store.set('/ui/slaResult', 'No first-response SLA data for tickets resolved this month.');
      return;
    }

    const pct = Math.round((compliant / eligible) * 100);
    const suffix = truncated
      ? ` (last ${issues.length} resolved this month — more exist)`
      : ` (${eligible} resolved this month)`;
    store.set('/ui/slaResult', `${pct}%${suffix}`);
  } catch (err) {
    if (!stale()) {
      store.set('/ui/slaResult', 'Could not check SLA % this month.');
    }
  } finally {
    if (!stale()) store.set('/ui/slaLoading', false);
  }
}

const check_sla_this_month = {
  description:
    'Compute first-response SLA compliance for tickets resolved this month in one JSM service desk\'s ' +
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
const sla_pct_label: ComputedFunction = (args) => {
  const result = args.result;
  return typeof result === 'string' && result.length > 0 ? result : 'Check SLA % this month';
};

const elements: PluginElementsModule = {
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
  },
  actions: {
    check_sla_this_month,
  },
};

export default elements;
