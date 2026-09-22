import type { ComputedFunction, PluginElementsModule } from './types';

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] as const;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ── days_waiting ─────────────────────────────────────────────────────────────
// Compute whole days elapsed since an ISO 8601 date string (e.g. sentDateTime).
// Args: { value: string } — the ISO timestamp from DocuSign.
// Returns: number of whole days (0 if same-day, -1 if parsing fails).
const days_waiting: ComputedFunction = (args) => {
  const raw = args.value;
  if (!raw || typeof raw !== 'string') return -1;
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return -1;
  return Math.max(0, Math.floor((Date.now() - ms) / MS_PER_DAY));
};

// ── age_tone ─────────────────────────────────────────────────────────────────
// Map elapsed days to a status tone per TILE-DISPLAY-STANDARDS.md §7.
//   ≤ 2 days  → success     (green — recently sent, no action needed yet)
//   3–7 days  → warning     (amber — recipient is taking a while)
//   ≥ 8 days  → destructive (red   — overdue, needs follow-up)
// Args: { value: number } — output of docusign_days_waiting.
const age_tone: ComputedFunction = (args) => {
  const days = Number(args.value);
  if (!Number.isFinite(days) || days < 0) return 'muted';
  if (days <= 2) return 'success';
  if (days <= 7) return 'warning';
  return 'destructive';
};

// ── age_label ────────────────────────────────────────────────────────────────
// Human-readable elapsed-time label. "Today" / "1 day" / "N days".
// Args: { value: number } — output of docusign_days_waiting.
const age_label: ComputedFunction = (args) => {
  const days = Number(args.value);
  if (!Number.isFinite(days) || days < 0) return '—';
  if (days === 0) return 'Today';
  return `${days} day${days === 1 ? '' : 's'}`;
};

// ── sent_meta ────────────────────────────────────────────────────────────────
// Format the row's second line: "Sent dd-Mmm-yy · Status Label".
// Args: { sent: string, status: string }
// Returns: e.g. "Sent 20-Sep-26 · Delivered"
const sent_meta: ComputedFunction = (args) => {
  const raw = args.sent;
  const status = typeof args.status === 'string' ? args.status : '';

  let datePart = '';
  if (typeof raw === 'string' && raw) {
    const ms = Date.parse(raw);
    if (Number.isFinite(ms)) {
      const d = new Date(ms);
      const day = String(d.getUTCDate()).padStart(2, '0');
      const mon = MONTH_ABBR[d.getUTCMonth()];
      const yr  = String(d.getUTCFullYear()).slice(-2);
      datePart = `${day}-${mon}-${yr}`;
    }
  }

  const statusLabel = docuSignStatusLabel(status);

  if (datePart && statusLabel) return `Sent ${datePart} · ${statusLabel}`;
  if (datePart) return `Sent ${datePart}`;
  return statusLabel;
};

// ── status_label ─────────────────────────────────────────────────────────────
// Title-case DocuSign envelope status per TILE-DISPLAY-STANDARDS.md §3.
// Args: { value: string }
const status_label: ComputedFunction = (args) => {
  return docuSignStatusLabel(typeof args.value === 'string' ? args.value : '');
};

function docuSignStatusLabel(raw: string): string {
  switch (raw.toLowerCase()) {
    case 'sent':      return 'Sent';
    case 'delivered': return 'Viewed';
    case 'completed': return 'Completed';
    case 'declined':  return 'Declined';
    case 'voided':    return 'Voided';
    case 'created':   return 'Draft';
    default: return raw ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : '';
  }
}

// ── status_tone ──────────────────────────────────────────────────────────────
// Tone for the envelope status badge.
// Args: { value: string }
const status_tone: ComputedFunction = (args) => {
  const s = typeof args.value === 'string' ? args.value.toLowerCase() : '';
  if (s === 'completed') return 'success';
  if (s === 'sent' || s === 'delivered') return 'info';
  if (s === 'declined' || s === 'voided') return 'muted';
  return 'muted';
};

// ── filter_pending ────────────────────────────────────────────────────────────
// Filter an envelopes array to only "sent" and "delivered" status entries
// (envelopes still awaiting a recipient signature). Used via a card `watch`
// to pre-populate /ui/pendingEnvelopes so the repeat.statePath is a plain
// state path rather than a computed expression (per RULE 5.9 in the widget
// interpreter spec: $computed inside repeat.statePath is unsupported).
// Args: { value: unknown[] } — the /docusign/list_envelopes/envelopes array.
const filter_pending: ComputedFunction = (args) => {
  const envelopes = Array.isArray(args.value) ? args.value : [];
  return envelopes.filter((env) => {
    const status = String((env as Record<string, unknown>).status ?? '').toLowerCase();
    return status === 'sent' || status === 'delivered';
  });
};

const elements: PluginElementsModule = {
  slug: 'docusign',
  functions: {
    days_waiting,
    age_tone,
    age_label,
    sent_meta,
    status_label,
    status_tone,
    filter_pending,
  },
};

export default elements;
