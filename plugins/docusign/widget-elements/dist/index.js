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

// "Rem Fermin" → "R. Fermin"
function abbreviateName(name) {
    const words = name.split(/\s+/).filter(Boolean);
    if (words.length < 2) return name;
    return `${words[0][0].toUpperCase()}. ${words[words.length - 1]}`;
}

// "F. LastName — Subject" or just "Subject" if no signer name.
const row_title = (args) => {
    const subject = typeof args.subject === 'string' ? args.subject.trim() : '';
    const recipients = args.recipients;
    if (!recipients || typeof recipients !== 'object') return subject;
    const signers = recipients.signers;
    if (!Array.isArray(signers) || signers.length === 0) return subject;
    const first = signers[0];
    const name = typeof first?.name === 'string' ? first.name.trim() : '';
    if (!name) return subject;
    return `${abbreviateName(name)} — ${subject}`;
};

// Activity-feed primary text line.
//   completed → "Completed — Subject"
//   delivered → "Viewed by R. Name — Subject"
//   sent      → "Sent — Subject to R. Name"
//   declined  → "Declined by R. Name — Subject"
//   voided    → "Voided — Subject"
//   created   → "Draft — Subject"
const activity_line = (args) => {
    const status  = typeof args.status  === 'string' ? args.status.toLowerCase()  : '';
    const subject = typeof args.subject === 'string' ? args.subject.trim()        : '';
    const recipients = args.recipients;
    const signers = Array.isArray(recipients?.signers) ? recipients.signers : [];
    const firstName = () => {
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

// Dot tone for the activity feed.
//   completed → success, delivered → accent, sent → info, declined/voided → destructive
const activity_dot_tone = (args) => {
    const s = typeof args.value === 'string' ? args.value.toLowerCase() : '';
    if (s === 'completed') return 'success';
    if (s === 'delivered') return 'accent';
    if (s === 'sent')      return 'info';
    if (s === 'declined' || s === 'voided') return 'destructive';
    return 'muted';
};

// Human-readable relative timestamp for the activity feed.
//   < 1 min  → "Just now"
//   < 1 hour → "N minutes ago"
//   < 1 day  → "N hours ago"
//   1 day    → "Yesterday"
//   2–6 days → "N days ago"
//   ≥ 7 days → "dd-Mmm-yy"
const relative_time = (args) => {
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
        row_title,
        activity_line,
        activity_dot_tone,
        relative_time,
    },
};

export default elements;
