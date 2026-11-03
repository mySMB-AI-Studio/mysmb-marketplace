// Invoice Nudge widget elements. The host prefixes each function with the slug,
// so the tile calls them as xero-invoice-nudge_nudge_label and xero-invoice-nudge_nudge_tone.

function toEpochMs(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number') return raw;
  if (typeof raw !== 'string') return null;
  const m = raw.match(/\/Date\((-?\d+)([+-]\d{4})?\)\//);
  if (m) return Number(m[1]);
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function daysOverdue(raw) {
  const ms = toEpochMs(raw);
  if (ms == null) return 0;
  return Math.max(0, Math.floor((Date.now() - ms) / 86400000));
}

// Args: { due }. "Nudge now" past 30 days, "Nudge soon" past 7, else "Watch".
const nudge_label = (args) => {
  const d = daysOverdue(args.due);
  if (d > 30) return 'Nudge now · ' + d + 'd';
  if (d > 7) return 'Nudge soon · ' + d + 'd';
  return d > 0 ? 'Watch · ' + d + 'd' : 'Not due';
};

// Args: { due }. Matches nudge_label's thresholds.
const nudge_tone = (args) => {
  const d = daysOverdue(args.due);
  if (d > 30) return 'danger';
  if (d > 7) return 'warning';
  return 'neutral';
};

const elements = {
  slug: 'xero-invoice-nudge',
  functions: { nudge_label, nudge_tone },
};
export default elements;
