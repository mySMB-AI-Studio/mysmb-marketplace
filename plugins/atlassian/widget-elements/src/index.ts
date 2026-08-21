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

const elements: PluginElementsModule = {
  slug: 'atlassian',
  functions: {
    sla_tone,
    sla_label,
  },
};

export default elements;
