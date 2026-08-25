import type { ComputedFunction, PluginElementsModule } from './types';

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
export type RequestBucket = 'new' | 'in_progress' | 'behind' | 'alerts';

interface JsmRequest {
  currentStatus?: { statusCategory?: string };
  sla?: { values?: unknown[] };
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

function classifyRequest(request: unknown): RequestBucket {
  const cycle = findResolutionCycle(request);
  if (cycle?.breached === true) return 'alerts';
  if (cycle && isAtRisk(cycle)) return 'behind';
  const category = normalizeCategory((request as JsmRequest | undefined)?.currentStatus?.statusCategory);
  if (category === 'NEW') return 'new';
  return 'in_progress';
}

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

const elements: PluginElementsModule = {
  slug: 'atlassian',
  functions: {
    sla_tone,
    sla_label,
    request_bucket,
    bucket_count,
    filter_by_bucket,
    bucket_tone,
  },
};

export default elements;
