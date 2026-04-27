/**
 * xero-accounting — widget-elements module
 * ──────────────────────────────────────────────────────────────────
 * Connector-specific `$computed` helpers contributed to the host's
 * widgets-system at runtime. The host prepends the slug `xero-accounting_`
 * to every name in `functions`, so e.g. the spec-side reference is
 * `xero-accounting_format_date`.
 *
 * Helpers here only make sense for Xero payloads (Microsoft-JSON dates,
 * Xero status enums, Xero report-tree shape).
 */
// Internal: parse any value Xero might give us as a "date-ish" into epoch ms.
function toEpochMs(raw) {
    if (raw == null)
        return null;
    if (typeof raw === 'number')
        return raw;
    if (typeof raw !== 'string')
        return null;
    const m = raw.match(/\/Date\((-?\d+)([+-]\d{4})?\)\//);
    if (m)
        return Number(m[1]);
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : null;
}
// ── format_date ──────────────────────────────────────────────────────
// Xero returns dates as `/Date(1772150400000+0000)/` (Microsoft JSON
// date format). This extracts the epoch millis and formats as a short
// human-readable date.
//
// Args: { value: string | number, format?: 'short'|'medium'|'long'|'iso' }
const format_date = (args) => {
    const raw = args.value;
    const format = args.format || 'short';
    if (raw == null)
        return '';
    const ms = toEpochMs(raw);
    if (ms == null)
        return String(raw);
    const d = new Date(ms);
    if (format === 'iso')
        return d.toISOString().slice(0, 10);
    if (format === 'long') {
        return d.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    }
    if (format === 'medium') {
        return d.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    }
    return d.toLocaleDateString(undefined, {
        year: '2-digit',
        month: 'short',
        day: 'numeric',
    });
};
// ── status_tone ──────────────────────────────────────────────────────
// Map Xero status strings to our semantic tone palette.
// Args: { value: string }
const status_tone = (args) => {
    const s = String(args.value ?? '').toUpperCase();
    if (s === 'PAID' || s === 'AUTHORISED')
        return 'success';
    if (s === 'DRAFT')
        return 'muted';
    if (s === 'SUBMITTED')
        return 'info';
    if (s === 'VOIDED' || s === 'DELETED')
        return 'destructive';
    return 'default';
};
// ── bank_tx_icon ─────────────────────────────────────────────────────
// Lucide icon name for a bank-transaction Type. RECEIVE* → down-arrow,
// SPEND* → up-arrow, anything else → neutral receipt.
const bank_tx_icon = (args) => {
    const t = String(args.value ?? '');
    if (t.startsWith('RECEIVE'))
        return 'ArrowDownCircle';
    if (t.startsWith('SPEND'))
        return 'ArrowUpCircle';
    return 'Receipt';
};
// ── bank_tx_tone ─────────────────────────────────────────────────────
// Tone for a bank-transaction row.
const bank_tx_tone = (args) => {
    const t = String(args.value ?? '');
    if (t.startsWith('RECEIVE'))
        return 'success';
    if (t.startsWith('SPEND'))
        return 'destructive';
    return 'muted';
};
const flatten_report_rows = (args) => {
    const include = Array.isArray(args.includeTypes)
        ? new Set(args.includeTypes.map(String))
        : new Set(['Row', 'SummaryRow']);
    const src = args.value;
    const rows = Array.isArray(src)
        ? src
        : src?.Rows ??
            src?.Reports?.[0]?.Rows ??
            [];
    if (!Array.isArray(rows))
        return [];
    const out = [];
    const walk = (list, depth, sectionTitle) => {
        for (const r of list) {
            if (!r || typeof r !== 'object')
                continue;
            const rowType = String(r.RowType ?? '');
            const title = String(r.Title ?? '');
            const cells = Array.isArray(r.Cells) ? r.Cells : null;
            if (rowType === 'Section' && Array.isArray(r.Rows)) {
                walk(r.Rows, depth + 1, title || sectionTitle);
                continue;
            }
            if (!include.has(rowType))
                continue;
            const flat = {
                title: cells?.[0]?.Value != null ? String(cells[0].Value) : title,
                rowType,
                depth,
                sectionTitle,
            };
            if (cells) {
                cells.forEach((cell, idx) => {
                    flat[`c${idx}`] = cell?.Value ?? '';
                });
            }
            out.push(flat);
        }
    };
    walk(rows, 0, '');
    return out;
};
// ── report_find_row ──────────────────────────────────────────────────
// Find a specific row in a flattened-report array by case-insensitive
// title match, return its cell `cN` value as a number (or 0).
const report_find_row = (args) => {
    const arr = args.value;
    if (!Array.isArray(arr))
        return 0;
    const want = String(args.title ?? '').toLowerCase();
    const cellIdx = typeof args.cell === 'number' ? args.cell : 1;
    const row = arr.find((r) => {
        const t = String(r?.title ?? '').toLowerCase();
        return t === want || t.includes(want);
    });
    if (!row)
        return 0;
    const raw = row[`c${cellIdx}`];
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
};
// ── po_status_tone ───────────────────────────────────────────────────
// Tone for a Xero PurchaseOrder.Status value.
const po_status_tone = (args) => {
    const s = String(args.value ?? '').toUpperCase();
    if (s === 'DRAFT')
        return 'muted';
    if (s === 'SUBMITTED')
        return 'info';
    if (s === 'AUTHORISED')
        return 'warning';
    if (s === 'BILLED')
        return 'success';
    if (s === 'DELETED')
        return 'destructive';
    return 'default';
};
// ── quote_status_tone ────────────────────────────────────────────────
// Tone for a Xero Quote.Status value.
const quote_status_tone = (args) => {
    const s = String(args.value ?? '').toUpperCase();
    if (s === 'DRAFT')
        return 'muted';
    if (s === 'SENT')
        return 'info';
    if (s === 'ACCEPTED')
        return 'success';
    if (s === 'INVOICED')
        return 'success';
    if (s === 'DECLINED')
        return 'destructive';
    return 'default';
};
// ── this_month_range ─────────────────────────────────────────────────
// Date range for the current calendar month, in ISO (yyyy-mm-dd).
const this_month_range = () => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
        fromDate: from.toISOString().slice(0, 10),
        toDate: to.toISOString().slice(0, 10),
    };
};
// ── prev_month_range ─────────────────────────────────────────────────
// Date range for the previous calendar month, in ISO.
const prev_month_range = () => {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 0);
    return {
        fromDate: from.toISOString().slice(0, 10),
        toDate: to.toISOString().slice(0, 10),
    };
};
// ── next_n_days ──────────────────────────────────────────────────────
// Date range from today to N days ahead, inclusive.
const next_n_days = (args) => {
    const n = typeof args.n === 'number' ? args.n : 30;
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from.getTime() + n * 24 * 60 * 60 * 1000);
    return {
        fromDate: from.toISOString().slice(0, 10),
        toDate: to.toISOString().slice(0, 10),
    };
};
// ── days_overdue ─────────────────────────────────────────────────────
// Days since a due date — positive past due, negative still upcoming.
const days_overdue = (args) => {
    const ms = toEpochMs(args.value);
    if (ms == null)
        return 0;
    const day = 24 * 60 * 60 * 1000;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(ms);
    due.setHours(0, 0, 0, 0);
    return Math.round((today.getTime() - due.getTime()) / day);
};
// ── overdue_label ────────────────────────────────────────────────────
// "12d overdue" / "due today" / "due in 5d".
const overdue_label = (args) => {
    const n = Number(days_overdue({ value: args.value }));
    if (!Number.isFinite(n))
        return '';
    if (n === 0)
        return 'due today';
    if (n > 0)
        return `${n}d overdue`;
    return `due in ${-n}d`;
};
// ── overdue_tone ─────────────────────────────────────────────────────
// Tone for an overdue badge. <=0 muted, <=30 warning, >30 destructive.
const overdue_tone = (args) => {
    const n = Number(days_overdue({ value: args.value }));
    if (!Number.isFinite(n) || n <= 0)
        return 'muted';
    if (n <= 30)
        return 'warning';
    return 'destructive';
};
// ── age_bucket ───────────────────────────────────────────────────────
// Aged bucket label. "Current" | "1-30" | "31-60" | "61-90" | "90+".
const age_bucket = (args) => {
    const n = Number(days_overdue({ value: args.value }));
    if (!Number.isFinite(n) || n <= 0)
        return 'Current';
    if (n <= 30)
        return '1-30';
    if (n <= 60)
        return '31-60';
    if (n <= 90)
        return '61-90';
    return '90+';
};
// ── age_bucket_tone ──────────────────────────────────────────────────
// Semantic tone for the aged bucket above.
const age_bucket_tone = (args) => {
    const bucket = String(age_bucket({ value: args.value }));
    if (bucket === 'Current')
        return 'success';
    if (bucket === '1-30')
        return 'info';
    if (bucket === '31-60')
        return 'warning';
    return 'destructive';
};
const elements = {
    slug: 'xero-accounting',
    functions: {
        format_date,
        status_tone,
        age_bucket,
        age_bucket_tone,
        bank_tx_icon,
        bank_tx_tone,
        days_overdue,
        overdue_label,
        overdue_tone,
        po_status_tone,
        quote_status_tone,
        this_month_range,
        prev_month_range,
        next_n_days,
        flatten_report_rows,
        report_find_row,
    },
};
export default elements;
