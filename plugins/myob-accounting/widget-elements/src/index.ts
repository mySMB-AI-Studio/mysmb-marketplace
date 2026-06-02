/**
 * myob-accounting — widget-elements module
 * ──────────────────────────────────────────────────────────────────
 * Connector-specific `$computed` helpers contributed to the host's
 * widgets-system at runtime. The host prepends the slug `myob-accounting_`
 * to every name in `functions`, so e.g. the spec-side reference is
 * `myob-accounting_format_currency`.
 */

import type { ComputedFunction, PluginElementsModule } from './types';

// ── format_currency ──────────────────────────────────────────────────
// Format a number as AUD using en-AU locale so the symbol renders as
// "$" rather than "A$" (which Intl produces in non-AU locales).
// Args: { value: number | string }
const format_currency: ComputedFunction = (args) => {
  const n = Number(args.value);
  if (!Number.isFinite(n)) return '';
  const fmt = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' });
  return fmt.formatToParts(n).map(p => p.type === 'currency' ? p.value + ' ' : p.value).join('');
};

// ── overdue_buckets ──────────────────────────────────────────────────
// Groups open invoices into overdue age buckets based on DueDate.
// Only includes invoices where DueDate < today (genuinely overdue).
// Returns { buckets: [{ key, label, count, total, tone }], total, count }
// Buckets are ordered worst-first: 30+, 16-30, 1-15 days overdue.
// Buckets with zero invoices are omitted from the result.
// Args: { value: Invoice[] }
const overdue_buckets: ComputedFunction = (args) => {
  const items = Array.isArray(args.value) ? (args.value as Record<string, unknown>[]) : [];
  const now = Date.now();
  const MS_PER_DAY = 86_400_000;

  const BUCKETS = [
    { key: '30+',   label: 'Over 30 days overdue',   min: 31, max: Infinity, tone: 'destructive' },
    { key: '16-30', label: '16 to 30 days overdue',  min: 16, max: 30,       tone: 'warning'     },
    { key: '1-15',  label: '1 to 15 days overdue',   min: 1,  max: 15,       tone: 'muted'       },
  ];

  let grandTotal = 0;
  let grandCount = 0;

  const buckets = BUCKETS.map((b) => {
    let count = 0;
    let total = 0;
    for (const item of items) {
      const due = new Date(String(item['DueDate'])).getTime();
      if (!Number.isFinite(due)) continue;
      const days = Math.floor((now - due) / MS_PER_DAY);
      if (days >= b.min && days <= b.max) {
        count++;
        total += Number(item['BalanceDueAmount']) || 0;
      }
    }
    grandTotal += total;
    grandCount += count;
    return { key: b.key, label: b.label, count, total, tone: b.tone };
  }).filter((b) => b.count > 0);

  return { buckets, total: grandTotal, count: grandCount };
};

const elements: PluginElementsModule = {
  slug: 'myob-accounting',
  functions: {
    format_currency,
    overdue_buckets,
  },
};

export default elements;
