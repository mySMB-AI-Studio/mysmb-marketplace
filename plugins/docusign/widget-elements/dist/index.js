const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const days_waiting = (args) => {
    const raw = args.value;
    if (!raw || typeof raw !== 'string') return -1;
    const ms = Date.parse(raw);
    if (!Number.isFinite(ms)) return -1;
    return Math.max(0, Math.floor((Date.now() - ms) / MS_PER_DAY));
};

const age_tone = (args) => {
    const days = Number(args.value);
    if (!Number.isFinite(days) || days < 0) return 'muted';
    if (days <= 2) return 'success';
    if (days <= 7) return 'warning';
    return 'destructive';
};

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

// "dd-Mmm-yy · Status" — no leading "Sent" prefix.
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
    if (datePart && statusLabel) return `${datePart} · ${statusLabel}`;
    if (datePart) return datePart;
    return statusLabel;
};

const status_label = (args) => {
    return docuSignStatusLabel(typeof args.value === 'string' ? args.value : '');
};

const status_tone = (args) => {
    const s = typeof args.value === 'string' ? args.value.toLowerCase() : '';
    if (s === 'completed') return 'success';
    if (s === 'sent' || s === 'delivered') return 'info';
    return 'muted';
};

// First signer's name from the recipients object embedded via include='recipients'.
const first_signer_name = (args) => {
    const recipients = args.recipients;
    if (!recipients || typeof recipients !== 'object') return '';
    const signers = recipients.signers;
    if (!Array.isArray(signers) || signers.length === 0) return '';
    const first = signers[0];
    return typeof first?.name === 'string' ? first.name.trim() : '';
};

// "First Signer — Subject" when recipients are available, else just "Subject".
const row_title = (args) => {
    const subject = typeof args.subject === 'string' ? args.subject.trim() : '';
    const recipients = args.recipients;
    if (!recipients || typeof recipients !== 'object') return subject;
    const signers = recipients.signers;
    if (!Array.isArray(signers) || signers.length === 0) return subject;
    const first = signers[0];
    const name = typeof first?.name === 'string' ? first.name.trim() : '';
    if (!name) return subject;
    return `${name} — ${subject}`;
};

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
        first_signer_name,
        row_title,
        filter_pending,
    },
};

export default elements;
