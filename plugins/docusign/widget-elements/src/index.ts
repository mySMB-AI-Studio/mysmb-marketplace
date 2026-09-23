import type { ComputedFunction, PluginElementsModule } from './types';

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] as const;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ── days_waiting ─────────────────────────────────────────────────────────────
// Whole days elapsed since an ISO 8601 timestamp (e.g. sentDateTime).
// Args: { value: string }
const days_waiting: ComputedFunction = (args) => {
  const raw = args.value;
  if (!raw || typeof raw !== 'string') return -1;
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return -1;
  return Math.max(0, Math.floor((Date.now() - ms) / MS_PER_DAY));
};

// ── age_tone ─────────────────────────────────────────────────────────────────
//   ≤ 2 days  → success     (green)
//   3–7 days  → warning     (amber)
//   ≥ 8 days  → destructive (red)
// Args: { value: number } — output of docusign_days_waiting.
const age_tone: ComputedFunction = (args) => {
  const days = Number(args.value);
  if (!Number.isFinite(days) || days < 0) return 'muted';
  if (days <= 2) return 'success';
  if (days <= 7) return 'warning';
  return 'destructive';
};

// ── age_label ────────────────────────────────────────────────────────────────
// "Today" / "1 day" / "N days".
// Args: { value: number } — output of docusign_days_waiting.
const age_label: ComputedFunction = (args) => {
  const days = Number(args.value);
  if (!Number.isFinite(days) || days < 0) return '—';
  if (days === 0) return 'Today';
  return `${days} day${days === 1 ? '' : 's'}`;
};

// ── sent_meta ────────────────────────────────────────────────────────────────
// Format "dd-Mmm-yy · Status Label" (no "Sent" prefix).
// Args: { sent: string, status: string }
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
  if (datePart && statusLabel) return `${datePart} · ${statusLabel}`;
  if (datePart) return datePart;
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
  return 'muted';
};

// ── row_title ─────────────────────────────────────────────────────────────────
// Build the row's primary line: "F. LastName — Subject" when recipient data
// is available (list_envelopes called with include='recipients'), falling back
// to just "Subject" when it isn't.
// Name is abbreviated to first initial + last name: "Rem Fermin" → "R. Fermin".
// Args: { recipients: object, subject: string }
const row_title: ComputedFunction = (args) => {
  const subject = typeof args.subject === 'string' ? args.subject.trim() : '';
  const recipients = args.recipients as Record<string, unknown> | null | undefined;
  if (!recipients || typeof recipients !== 'object') return subject;
  const signers = recipients.signers;
  if (!Array.isArray(signers) || signers.length === 0) return subject;
  const first = signers[0] as Record<string, unknown> | undefined;
  const name = typeof first?.name === 'string' ? first.name.trim() : '';
  if (!name) return subject;
  const abbreviated = abbreviateName(name);
  return `${abbreviated} — ${subject}`;
};

function abbreviateName(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length < 2) return name;
  return `${words[0][0].toUpperCase()}. ${words[words.length - 1]}`;
}

// ── filter_pending ────────────────────────────────────────────────────────────
// Filter an envelopes array to only "sent" and "delivered" entries.
// Used via a card `watch` to pre-populate /ui/pendingEnvelopes.
// Args: { value: unknown[] }
const filter_pending: ComputedFunction = (args) => {
  const envelopes = Array.isArray(args.value) ? args.value : [];
  return envelopes.filter((env) => {
    const status = String((env as Record<string, unknown>).status ?? '').toLowerCase();
    return status === 'sent' || status === 'delivered';
  });
};

// ── abbreviateName ────────────────────────────────────────────────────────────
// "Rem Fermin" → "R. Fermin"  (first letter of first word + ". " + last word)
function abbreviateName(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length < 2) return name;
  return `${words[0][0].toUpperCase()}. ${words[words.length - 1]}`;
}

// ── row_title ─────────────────────────────────────────────────────────────────
// Build the primary text for a pending-signatures row.
// Format: "F. LastName — Subject" when a signer is present, else just "Subject".
// Args: { subject: string, recipients: object }
const row_title: ComputedFunction = (args) => {
  const subject = typeof args.subject === 'string' ? args.subject.trim() : '';
  const recipients = args.recipients as Record<string, unknown> | null | undefined;
  if (!recipients || typeof recipients !== 'object') return subject;
  const signers = recipients.signers;
  if (!Array.isArray(signers) || signers.length === 0) return subject;
  const first = signers[0] as Record<string, unknown> | undefined;
  const name = typeof first?.name === 'string' ? first.name.trim() : '';
  if (!name) return subject;
  return `${abbreviateName(name)} — ${subject}`;
};

// ── activity_line ─────────────────────────────────────────────────────────────
// Build the primary activity-feed text line from envelope status + recipients.
//   completed → "Completed — {subject}"
//   delivered → "Viewed by {R. Name} — {subject}"
//   sent      → "Sent — {subject} to {R. Name}"
//   declined  → "Declined by {R. Name} — {subject}"
//   voided    → "Voided — {subject}"
//   created   → "Draft — {subject}"
// Args: { status: string, subject: string, recipients: object }
const activity_line: ComputedFunction = (args) => {
  const status  = typeof args.status  === 'string' ? args.status.toLowerCase()  : '';
  const subject = typeof args.subject === 'string' ? args.subject.trim()        : '';
  const recipients = args.recipients as Record<string, unknown> | null | undefined;

  const signers: Record<string, unknown>[] = Array.isArray(
    (recipients as Record<string, unknown> | null)?.signers,
  )
    ? ((recipients as Record<string, unknown>).signers as Record<string, unknown>[])
    : [];

  const firstName = (): string => {
    if (signers.length === 0) return '';
    const s = signers[0];
    const n = typeof s.name === 'string' ? s.name.trim() : '';
    return abbreviateName(n);
  };

  switch (status) {
    case 'completed': return `Completed — ${subject}`;
    case 'delivered': {
      const n = firstName();
      return n ? `Viewed by ${n} — ${subject}` : `Viewed — ${subject}`;
    }
    case 'sent': {
      const n = firstName();
      return n ? `Sent — ${subject} to ${n}` : `Sent — ${subject}`;
    }
    case 'declined': {
      const n = firstName();
      return n ? `Declined by ${n} — ${subject}` : `Declined — ${subject}`;
    }
    case 'voided':  return `Voided — ${subject}`;
    case 'created': return `Draft — ${subject}`;
    default:        return subject;
  }
};

// ── activity_dot_tone ─────────────────────────────────────────────────────────
// Tone for the activity-feed row dot based on envelope status.
//   completed → success   (green)
//   delivered → accent    (purple — viewed but not signed)
//   sent      → info      (blue — awaiting action)
//   declined/voided → destructive (red)
// Args: { value: string }
const activity_dot_tone: ComputedFunction = (args) => {
  const s = typeof args.value === 'string' ? args.value.toLowerCase() : '';
  if (s === 'completed') return 'success';
  if (s === 'delivered') return 'accent';
  if (s === 'sent')      return 'info';
  if (s === 'declined' || s === 'voided') return 'destructive';
  return 'muted';
};

// ── relative_time ─────────────────────────────────────────────────────────────
// Human-readable relative timestamp for the activity feed.
//   < 1 min   → "Just now"
//   < 1 hour  → "N minutes ago"
//   < 1 day   → "N hours ago"
//   1 day     → "Yesterday"
//   2–6 days  → "N days ago"
//   ≥ 7 days  → "dd-Mmm-yy"
// Args: { value: string } — ISO timestamp (e.g. statusChangedDateTime).
const relative_time: ComputedFunction = (args) => {
  const raw = typeof args.value === 'string' ? args.value : '';
  if (!raw) return '—';
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return '—';
  const diffMs   = Date.now() - ms;
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1)  return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays <= 6)  return `${diffDays} days ago`;
  const d   = new Date(ms);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const mon = MONTH_ABBR[d.getUTCMonth()];
  const yr  = String(d.getUTCFullYear()).slice(-2);
  return `${day}-${mon}-${yr}`;
};

// ── completed_stats ───────────────────────────────────────────────────────────
// Compute all KPI stats for the Completed This Month and Avg. Turnaround tiles.
// Splits the fetched envelope dataset into current-month and last-month buckets
// and derives counts, rates, daily sparklines, and turnaround averages.
// Args: { value: unknown[] } — the /docusign/list_envelopes/envelopes array
//       (pre-filtered to status=completed at the provider level).
const completed_stats: ComputedFunction = (args) => {
  const envelopes = Array.isArray(args.value)
    ? (args.value as Record<string, unknown>[])
    : [];

  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth();
  const today = now.getDate();

  const thisMonthStart  = new Date(year, month,     1).getTime();
  const lastMonthStart  = new Date(year, month - 1, 1).getTime();
  const daysInLastMonth = new Date(year, month, 0).getDate();

  const completed = envelopes.filter(
    e => String(e.status ?? '').toLowerCase() === 'completed',
  );

  const inPeriod = (e: Record<string, unknown>, from: number, to: number) => {
    const t = Date.parse(String(e.completedDateTime ?? e.statusChangedDateTime ?? ''));
    return Number.isFinite(t) && t >= from && t < to;
  };

  const thisMonth = completed.filter(e => inPeriod(e, thisMonthStart, Infinity));
  const lastMonth = completed.filter(e => inPeriod(e, lastMonthStart, thisMonthStart));

  // ── Completed count & trend ─────────────────────────────────────────────
  const thisRate = thisMonth.length / today;
  const lastRate = lastMonth.length / daysInLastMonth;
  let completedTrendText = '—';
  let completedTrendTone = 'muted';
  let completedTrendIcon = 'Minus';
  if (lastMonth.length > 0) {
    const pct  = Math.round(((thisRate - lastRate) / lastRate) * 100);
    const sign = pct >= 0 ? '+' : '';
    completedTrendText = `${sign}${pct}% vs Last Month`;
    completedTrendTone = pct >= 0 ? 'success' : 'destructive';
    completedTrendIcon = pct >= 0 ? 'TrendingUp' : 'TrendingDown';
  }

  // ── Daily sparkline helpers ──────────────────────────────────────────────
  const dayBucket = (envs: Record<string, unknown>[], d: number) => {
    const s = new Date(year, month, d).getTime();
    const e = new Date(year, month, d + 1).getTime();
    return envs.filter(ev => inPeriod(ev, s, e));
  };

  const completedSparkline: number[] = [];
  for (let d = 1; d <= today; d++) {
    completedSparkline.push(dayBucket(thisMonth, d).length);
  }

  // ── Avg turnaround (sent → completed) ───────────────────────────────────
  const turnaroundDays = (envs: Record<string, unknown>[]): number[] =>
    envs
      .map(e => {
        const sent = Date.parse(String(e.sentDateTime ?? ''));
        const comp = Date.parse(String(e.completedDateTime ?? e.statusChangedDateTime ?? ''));
        if (!Number.isFinite(sent) || !Number.isFinite(comp) || comp <= sent) return null;
        return (comp - sent) / MS_PER_DAY;
      })
      .filter((v): v is number => v !== null);

  const avg = (nums: number[]): number =>
    nums.length > 0
      ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10
      : 0;

  const avgThis = avg(turnaroundDays(thisMonth));
  const avgLast = avg(turnaroundDays(lastMonth));

  let turnaroundTrendText = '—';
  let turnaroundTrendTone = 'muted';
  let turnaroundTrendIcon = 'Minus';
  if (avgLast > 0 && avgThis > 0) {
    const delta  = Math.round(Math.abs(avgThis - avgLast) * 10) / 10;
    const faster = avgThis < avgLast;
    turnaroundTrendText = `${delta} day${delta === 1 ? '' : 's'} ${faster ? 'faster' : 'slower'}`;
    turnaroundTrendTone = faster ? 'success' : 'destructive';
    turnaroundTrendIcon = faster ? 'TrendingDown' : 'TrendingUp';
  }

  const turnaroundSparkline: number[] = [];
  for (let d = 1; d <= today; d++) {
    turnaroundSparkline.push(avg(turnaroundDays(dayBucket(thisMonth, d))));
  }

  // ── Date range label ─────────────────────────────────────────────────────
  const dateRange = `${MONTH_ABBR[month]} 1–20${String(today).padStart(2, '0')}`.replace(
    /1–\d+$/,
    `1–${today}`,
  );
  const safeDateRange = `${MONTH_ABBR[month]} 1–${today}`;

  return {
    completedCount:      String(thisMonth.length),
    completedDateRange:  safeDateRange,
    completedTrendText,
    completedTrendTone,
    completedTrendIcon,
    completedSparkline:  completedSparkline.length ? completedSparkline : [0],
    avgTurnaroundNum:    avgThis > 0 ? String(avgThis) : '—',
    turnaroundTrendText,
    turnaroundTrendTone,
    turnaroundTrendIcon,
    turnaroundSparkline: turnaroundSparkline.length ? turnaroundSparkline : [0],
  };
};

// ── envelope_overview_stats ───────────────────────────────────────────────────
// Compute status breakdown for the Envelope Status Overview tile.
// Buckets every envelope into completed / sent+delivered / declined / voided,
// computes proportional percentages (flex-grow values for the segmented bar),
// and pre-formats legend strings.
// Args: { value: unknown[] } — the /docusign/list_envelopes/envelopes array.
const envelope_overview_stats: ComputedFunction = (args) => {
  const envelopes = Array.isArray(args.value)
    ? (args.value as Record<string, unknown>[])
    : [];

  let completed = 0, sent = 0, delivered = 0, declined = 0, voided = 0;

  for (const e of envelopes) {
    const s = String(e.status ?? '').toLowerCase();
    if (s === 'completed')       completed++;
    else if (s === 'sent')       sent++;
    else if (s === 'delivered')  delivered++;
    else if (s === 'declined')   declined++;
    else if (s === 'voided')     voided++;
  }

  const sentDelivered = sent + delivered;
  const total = completed + sentDelivered + declined + voided;

  // Percentage of total for each bucket (0–100, used as ProgressBar value).
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);

  return {
    total:              String(total),
    completedPct:       pct(completed),
    sentPct:            pct(sentDelivered),
    declinedPct:        pct(declined),
    voidedPct:          pct(voided),
    completedCount:     String(completed),
    sentCount:          String(sentDelivered),
    declinedCount:      String(declined),
    voidedCount:        String(voided),
    completedVisible:   completed    > 0,
    sentVisible:        sentDelivered > 0,
    declinedVisible:    declined     > 0,
    voidedVisible:      voided       > 0,
  };
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
    row_title,
    filter_pending,
    row_title,
    activity_line,
    activity_dot_tone,
    relative_time,
    completed_stats,
    envelope_overview_stats,
  },
};

export default elements;
