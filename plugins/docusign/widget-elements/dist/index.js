const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Days elapsed since an ISO timestamp from DocuSign (sentDateTime, etc.).
const days_waiting = (args) => {
    const raw = args.value;
    if (!raw || typeof raw !== 'string') return -1;
    const ms = Date.parse(raw);
    if (!Number.isFinite(ms)) return -1;
    return Math.max(0, Math.floor((Date.now() - ms) / MS_PER_DAY));
};

// Map elapsed days to a status tone.
//   ≤ 2 days  → success     (green)
//   3–7 days  → warning     (amber)
//   ≥ 8 days  → destructive (red)
const age_tone = (args) => {
    const days = Number(args.value);
    if (!Number.isFinite(days) || days < 0) return 'muted';
    if (days <= 2) return 'success';
    if (days <= 7) return 'warning';
    return 'destructive';
};

// Human-readable elapsed-time label.
const age_label = (args) => {
    const days = Number(args.value);
    if (!Number.isFinite(days) || days < 0) return '—';
    if (days === 0) return 'Today';
    return `${days} day${days === 1 ? '' : 's'}`;
};

function docuSignStatusLabel(raw) {
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

// Format "Sent dd-Mmm-yy · Status".
const sent_meta = (args) => {
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

// Title-case DocuSign envelope status.
const status_label = (args) => {
    return docuSignStatusLabel(typeof args.value === 'string' ? args.value : '');
};

// Tone for the status badge.
const status_tone = (args) => {
    const s = typeof args.value === 'string' ? args.value.toLowerCase() : '';
    if (s === 'completed') return 'success';
    if (s === 'sent' || s === 'delivered') return 'info';
    return 'muted';
};

// Filter an envelopes array to only "sent"/"delivered" (awaiting signature).
const filter_pending = (args) => {
    const envelopes = Array.isArray(args.value) ? args.value : [];
    return envelopes.filter((env) => {
        const status = String((env).status ?? '').toLowerCase();
        return status === 'sent' || status === 'delivered';
    });
};

const elements = {
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
