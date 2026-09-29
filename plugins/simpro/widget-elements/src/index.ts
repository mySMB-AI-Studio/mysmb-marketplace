import type { ComputedFunction, CompositeComponentDef, PluginElementsModule } from './types';

export const slug = 'simpro';

// ─── Computed functions ───────────────────────────────────────────────────────

/**
 * Map a Simpro invoice status to a badge tone.
 * Args: { value: string }
 */
const invoice_tone: ComputedFunction = (args) => {
  const v = String(args.value ?? '');
  if (v === 'Paid') return 'success';
  if (v === 'Sent') return 'accent';
  if (v === 'Pending') return 'warning';
  if (v === 'Overdue') return 'destructive';
  if (v === 'Void') return 'muted';
  return 'muted';
};

/**
 * Map a Simpro quote status to a badge tone.
 * Args: { value: string }
 *
 * Matched against real values confirmed in the sandbox — Simpro's own
 * quote list colours these dots red/green/orange respectively, so this
 * intentionally does NOT use keyword substring matching (e.g. "To Be
 * Completed" contains "complete" but is the not-yet-started red state,
 * the opposite of what a naive keyword match would suggest).
 *
 * Quote : To Be Completed    → "destructive" (red)
 * Quote : In Progress        → "success"     (green)
 * Quote : Employee Scheduled → "warning"     (orange)
 * Approved                   → "success"
 * (default)                  → "muted"
 */
const quote_status_tone: ComputedFunction = (args) => {
  const v = String(args.value ?? '');
  if (v === 'Quote : To Be Completed') return 'destructive';
  if (v === 'Quote : In Progress') return 'success';
  if (v === 'Quote : Employee Scheduled') return 'warning';
  if (v === 'Approved') return 'success';
  return 'muted';
};

/**
 * Map a Simpro job status to a badge tone.
 * Args: { value: string }
 *
 * Matched against real values confirmed in the sandbox first (status names
 * are admin-customizable per Build, e.g. "Mobile : Awaiting Parts" rather
 * than a bare "Awaiting Parts"), then generic fallbacks for other Builds.
 *
 * Mobile : Awaiting Parts → "destructive" (blocked)
 * Job : Fully Invoiced    → "success"
 * Job : Fully-paid        → "success"
 * In Progress             → "warning"   (active, ongoing)
 * Scheduled / Pending     → "accent"    (booked, not started)
 * Awaiting Parts / Awaiting Materials → "destructive"
 * Completed / Complete / Ready to Invoice → "success"
 * (default)               → "muted"
 */
const job_status_tone: ComputedFunction = (args) => {
  const v = String(args.value ?? '');
  if (v === 'Mobile : Awaiting Parts') return 'destructive';
  if (v === 'Job : Fully Invoiced' || v === 'Job : Fully-paid') return 'success';
  if (v === 'In Progress') return 'warning';
  if (v === 'Scheduled' || v === 'Pending') return 'accent';
  if (v === 'Awaiting Parts' || v === 'Awaiting Materials') return 'destructive';
  if (v === 'Completed' || v === 'Complete' || v === 'Ready to Invoice') return 'success';
  return 'muted';
};

/**
 * Build a deep link to a specific quote/job/invoice in the Simpro web app.
 * Confirmed against the real sandbox (2026-08-25) — Simpro's row-level links
 * carry extra params (openDepSecID, openHash) that look session/record-scoped
 * and aren't returned by any list/get endpoint, but the bare ID param alone
 * is sufficient (Simpro resolves the record without them, given an active
 * browser session). Requires the viewer to already be logged into that
 * Simpro Build in their browser, same as any other vendor dashboard deep link.
 *
 * Args: { build_domain: string, kind: 'quote' | 'job' | 'invoice', id: number }
 * Returns: string URL, or '' if build_domain/id is missing
 */
const build_record_url: ComputedFunction = (args) => {
  const buildDomain = String(args.build_domain ?? '');
  const id = args.id;
  if (!buildDomain || id === undefined || id === null || id === '') return '';
  const kind = String(args.kind ?? '');
  if (kind === 'quote') return `https://${buildDomain}/staff/editCostCentre.php?quoteID=${id}`;
  if (kind === 'job') return `https://${buildDomain}/staff/editCostCentre.php?jobID=${id}`;
  if (kind === 'invoice') return `https://${buildDomain}/staff/editInvoice.php?invoiceID=${id}`;
  return '';
};

// ─── Composite components ─────────────────────────────────────────────────────

/**
 * Two-line time pill showing scheduled start and end time.
 * Props: start (string), end (string)
 *
 * Usage:
 *   { "type": "simpro/TimePill", "props": { "start": "07:30", "end": "10:00" } }
 */
const TimePill: CompositeComponentDef = {
  kind: 'composite',
  props: ['start', 'end'],
  spec: {
    root: 'pill',
    elements: {
      pill:  { type: 'Stack', props: { gap: 'none', align: 'center' }, children: ['s', 'e'] },
      s:     { type: 'Caption', props: { text: { $prop: 'start' } } },
      e:     { type: 'Caption', props: { text: { $prop: 'end' }, tone: 'muted' } },
    },
  },
};

// ─── Module export ────────────────────────────────────────────────────────────

const elements: PluginElementsModule = {
  slug: 'simpro',
  functions: { invoice_tone, job_status_tone, quote_status_tone, build_record_url },
  components: { TimePill },
};

export default elements;
