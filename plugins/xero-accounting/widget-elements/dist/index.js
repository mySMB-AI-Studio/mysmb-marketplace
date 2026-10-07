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
// ── status_label ─────────────────────────────────────────────────────
// TILE-DISPLAY-STANDARDS.md §3: never pass a raw connector enum straight
// to a Badge — Title Case the Xero status string (e.g. "AUTHORISED" →
// "Authorised") rather than showing the raw SCREAMING_CASE enum. Tone
// alone (status_tone) only controls color, not casing.
const status_label = (args) => {
    const s = String(args.value ?? '');
    if (!s)
        return '';
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
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
// ── bank_tx_label ────────────────────────────────────────────────────
// TILE-DISPLAY-STANDARDS.md §3: never show a raw connector enum. Xero's
// real Type values include suffixed variants (SPEND-OVERPAYMENT,
// RECEIVE-TRANSFER, etc.) — this collapses all of them to the plain
// direction word, same grouping bank_tx_icon/bank_tx_tone already use.
const bank_tx_label = (args) => {
    const t = String(args.value ?? '');
    if (t.startsWith('RECEIVE'))
        return 'Receive';
    if (t.startsWith('SPEND'))
        return 'Spend';
    return t;
};
// ── reconciliation_breakdown ─────────────────────────────────────────
// Reconciled/unreconciled is a real binary status (TILE-DISPLAY-STANDARDS.md
// §7's restraint model applies, not the categorical chart palette) —
// "success" always means done/paid/completed, matching a reconciled
// transaction; "warning" for unreconciled since it's a real pending
// action item, not a no-news-is-good-news default.
// Args: { transactions: array }
// Returns: { total, reconciled, unreconciled, segments: [{ status, count, tone }], template }
const reconciliation_breakdown = (args) => {
    const transactions = Array.isArray(args.transactions) ? args.transactions : [];
    const reconciled = transactions.filter((t) => t.IsReconciled === true).length;
    const unreconciled = transactions.length - reconciled;
    const segments = [
        { status: 'Reconciled', count: reconciled, tone: 'success' },
        { status: 'Unreconciled', count: unreconciled, tone: 'warning' },
    ].filter((s) => s.count > 0);
    return {
        total: transactions.length,
        reconciled,
        unreconciled,
        segments,
        template: segments.length ? segments.map((s) => `${s.count}fr`).join(' ') : '1fr',
    };
};
// Supplier is a portal-defined, open-ended label with no inherent
// good/bad meaning — a categorical (non-status) case per
// TILE-DISPLAY-STANDARDS.md §7, so it gets the `chart-1..5` palette.
// Only the top 5 suppliers by total amount paid get a distinct color;
// everyone else falls back to `muted` rather than reusing a color,
// which would falsely imply they're grouped with a top-5 supplier.
const REMITTANCE_CHART_TONES = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'];
function rankSuppliersByTotalPaid(payments) {
    const totals = new Map();
    for (const payment of payments) {
        const invoice = payment.Invoice;
        const supplier = invoice?.Contact?.Name || 'Unknown supplier';
        const amount = Number(payment.Amount) || 0;
        totals.set(supplier, (totals.get(supplier) ?? 0) + amount);
    }
    const toneBySupplier = new Map();
    [...totals.entries()]
        .sort((a, b) => b[1] - a[1])
        .forEach(([supplier], i) => {
        toneBySupplier.set(supplier, i < REMITTANCE_CHART_TONES.length ? REMITTANCE_CHART_TONES[i] : 'muted');
    });
    return toneBySupplier;
}
/**
 * Flattens a `list_payments` response (already filtered to
 * PaymentType=="ACCPAYPAYMENT") into rows for the Remittance tile — an
 * approximation of Xero's own remittance advice document (which invoices
 * were paid, to whom, how much, when), since Xero's public API has no
 * dedicated remittance-advice resource of its own.
 *
 * Each row carries `supplierTone` (chart-1..5 for the top 5 suppliers by
 * total amount paid, muted for the rest) so a row's supplier badge and
 * `xero-accounting_remittance_breakdown`'s bar segment for that same
 * supplier always share one color — the breakdown function reads this
 * same field rather than re-ranking independently.
 *
 * Args: { payments: array }
 * Returns: array of { id, supplier, supplierTone, invoiceId, invoiceNumber, amount, currencyCode, date }
 *
 * Spec example:
 *   {
 *     "$computed": "xero-accounting_remittance_rows",
 *     "args": { "payments": { "$state": "/xero-accounting/list_payments/Payments" } }
 *   }
 */
const remittance_rows = (args) => {
    const payments = Array.isArray(args.payments) ? args.payments : [];
    const toneBySupplier = rankSuppliersByTotalPaid(payments);
    return payments.map((payment) => {
        const invoice = payment.Invoice;
        const account = payment.Account;
        const supplier = invoice?.Contact?.Name || 'Unknown supplier';
        return {
            id: payment.PaymentID,
            supplier,
            supplierTone: toneBySupplier.get(supplier) ?? 'muted',
            invoiceId: invoice?.InvoiceID ?? null,
            invoiceNumber: invoice?.InvoiceNumber || '—',
            amount: Number(payment.Amount) || 0,
            currencyCode: account?.CurrencyCode || 'AUD',
            date: payment.Date ?? null,
        };
    });
};
/**
 * Groups Remittance rows (from `xero-accounting_remittance_rows`) into a
 * top-5-suppliers-by-amount-paid breakdown, reading each row's
 * already-assigned `supplierTone` rather than re-ranking, so the bar's
 * segment colors always match the row badges for the same supplier.
 * Segment width is proportional to amount paid (not row count), so the
 * bar visually communicates "who got paid the most", not just "who has
 * the most transactions".
 *
 * Args: { rows: array }
 * Returns: { total, segments: [{ supplier, amount, tone }], template }
 *
 * Spec example:
 *   {
 *     "$computed": "xero-accounting_remittance_breakdown",
 *     "args": { "rows": { "$state": "/ui/rows" } }
 *   }
 */
const remittance_breakdown = (args) => {
    const rows = Array.isArray(args.rows) ? args.rows : [];
    const totals = new Map();
    for (const row of rows) {
        const supplier = typeof row.supplier === 'string' && row.supplier ? row.supplier : 'Unknown supplier';
        const entry = totals.get(supplier) ?? { supplier, amount: 0, tone: row.supplierTone ?? 'muted' };
        entry.amount += Number(row.amount) || 0;
        totals.set(supplier, entry);
    }
    const segments = [...totals.values()]
        .filter((s) => s.tone !== 'muted')
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5);
    return {
        total: rows.length,
        segments,
        template: segments.length ? segments.map((s) => `${Math.max(1, Math.round(s.amount))}fr`).join(' ') : '1fr',
    };
};
/**
 * Flattens a `list_receipts` response (already filtered to Status=="DRAFT")
 * into rows for the Reimbursement Drafts tile. A Receipt is the Xero
 * object an employee fills in before it's grouped into an ExpenseClaim
 * for approval — "DRAFT" only exists at this level (ExpenseClaim itself
 * starts at SUBMITTED), so this is genuinely "things not yet submitted
 * for reimbursement", not an approximation.
 *
 * `isEmpty` flags a receipt with no line items / zero total — i.e.
 * someone started it in Xero and never finished — which is the real
 * actionable signal for this tile (a stale, abandoned draft vs. one
 * that's filled in and just needs submitting).
 *
 * Args: { receipts: array }
 * Returns: array of { id, userName, payee, amount, currencyCode, lineItemCount, isEmpty, updatedDate }
 */
const reimbursement_draft_rows = (args) => {
    const receipts = Array.isArray(args.receipts) ? args.receipts : [];
    return receipts.map((receipt) => {
        const user = receipt.User;
        const contact = receipt.Contact;
        const lineItems = Array.isArray(receipt.LineItems) ? receipt.LineItems : [];
        const total = Number(receipt.Total) || 0;
        const userName = [user?.FirstName, user?.LastName].filter(Boolean).join(' ') || 'Unknown';
        return {
            id: receipt.ReceiptID,
            userName,
            payee: contact?.Name || '—',
            amount: total,
            currencyCode: receipt.CurrencyCode || 'AUD',
            lineItemCount: lineItems.length,
            isEmpty: lineItems.length === 0 && total === 0,
            updatedDate: receipt.UpdatedDateUTC ?? null,
        };
    });
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
// ── overdue_only ─────────────────────────────────────────────────────
// Return only the invoices whose DueDate is in the past (daysOverdue > 0).
// Used by chase/collections widgets that want to exclude not-yet-due
// invoices from the AUTHORISED list.
// Args: { value: Invoice[] }
const overdue_only = (args) => {
    const arr = args.value;
    if (!Array.isArray(arr))
        return [];
    return arr.filter((inv) => {
        const due = inv?.DueDate;
        const n = Number(days_overdue({ value: due }));
        return Number.isFinite(n) && n > 0;
    });
};
// ── awaiting_payment_breakdown ────────────────────────────────────────
// Groups a list of AUTHORISED (not yet paid) invoices/bills by due-date
// severity, using the exact same thresholds as `overdue_tone` so a
// segment's color always matches what each row's own Dot/Badge already
// shows — never a second, independently-derived color language for the
// same underlying value.
// Args: { invoices: array }
// Returns: { total, segments: [{ status, count, tone }], template }
const awaiting_payment_breakdown = (args) => {
    const invoices = Array.isArray(args.invoices) ? args.invoices : [];
    let notYetDue = 0;
    let overdue = 0;
    let wellOverdue = 0;
    for (const inv of invoices) {
        const n = Number(days_overdue({ value: inv.DueDate }));
        if (!Number.isFinite(n) || n <= 0)
            notYetDue += 1;
        else if (n <= 30)
            overdue += 1;
        else
            wellOverdue += 1;
    }
    const segments = [
        { status: 'Not yet due', count: notYetDue, tone: 'muted' },
        { status: 'Overdue', count: overdue, tone: 'warning' },
        { status: 'Well overdue', count: wellOverdue, tone: 'destructive' },
    ].filter((s) => s.count > 0);
    return {
        total: invoices.length,
        segments,
        template: segments.length ? segments.map((s) => `${s.count}fr`).join(' ') : '1fr',
    };
};
// ── age_buckets ──────────────────────────────────────────────────────
// Aggregate a list of invoices into the 5 standard aging buckets.
// Returns a fixed-order array — always 5 entries, even buckets with no
// invoices — so the widget can render a stable shape:
//   [{ key: 'Current', total, count, tone },
//    { key: '1-30',    total, count, tone },
//    { key: '31-60',   total, count, tone },
//    { key: '61-90',   total, count, tone },
//    { key: '90+',     total, count, tone }]
// `tone` matches our semantic palette so the widget can colour each row.
// Args: { value: Invoice[] }
const age_buckets = (args) => {
    const arr = args.value;
    const tones = {
        Current: 'success',
        '1-30': 'info',
        '31-60': 'warning',
        '61-90': 'destructive',
        '90+': 'destructive',
    };
    const order = ['Current', '1-30', '31-60', '61-90', '90+'];
    const totals = new Map();
    for (const key of order)
        totals.set(key, { total: 0, count: 0 });
    if (Array.isArray(arr)) {
        for (const inv of arr) {
            const due = inv?.DueDate;
            const amt = Number(inv?.AmountDue);
            const bucket = String(age_bucket({ value: due }));
            const entry = totals.get(bucket);
            if (!entry)
                continue;
            entry.total += Number.isFinite(amt) ? amt : 0;
            entry.count += 1;
        }
    }
    return order.map((key) => ({
        key,
        total: totals.get(key).total,
        count: totals.get(key).count,
        tone: tones[key],
    }));
};
// ── invoices_in_bucket ───────────────────────────────────────────────
// Return only the invoices whose DueDate places them in a specific
// aging bucket. Used by the Aged Receivables widget to render the
// per-bucket drill-down list.
// Args: { value: Invoice[], bucket: 'Current'|'1-30'|'31-60'|'61-90'|'90+' }
const invoices_in_bucket = (args) => {
    const arr = args.value;
    const bucket = String(args.bucket ?? '');
    if (!Array.isArray(arr) || !bucket)
        return [];
    return arr.filter((inv) => {
        const due = inv?.DueDate;
        return String(age_bucket({ value: due })) === bucket;
    });
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
// ── analyze_duplicates ───────────────────────────────────────────────
// Cross-checks Xero Contacts, Invoices (both ACCPAY bills and ACCREC
// sales invoices), BankTransactions, and Payments for likely duplicates.
// Each of the 4 raw arrays may still be undefined (its tool call hasn't
// resolved yet) — treated as empty until it arrives, so the result
// converges as each of the 4 chained tool calls lands.
//
// "Same Contact" below means the same CANONICAL contact — Contacts that are
// themselves flagged as duplicates of each other (shared email/tax, or a
// fuzzy name hit) are merged into one cluster first, so a bill/invoice/bank
// line split across two duplicate contact records (e.g. "Acme" vs "Acme Pty
// Ltd", both real records for the same vendor) still matches its counterpart
// under the sibling record.
//
// Match rules, each tagged 'exact' or 'fuzzy' (see matchMode below):
//   Contacts        — exact: same normalized EmailAddress OR TaxNumber (ABN).
//                      fuzzy: similar Name (Levenshtein ratio >=0.82,
//                      bucketed by first name-token).
//   Supplier Bills   — Invoices where Type=="ACCPAY". exact: same Contact +
//                      same non-blank InvoiceNumber (a blank number is never
//                      matched — too common and not a real signal). fuzzy:
//                      same Contact + same Total, whole-group date span <=1
//                      day.
//   Sales Invoices   — Invoices where Type=="ACCREC". list_invoices always
//                      returns LineItems: [] (only the single-invoice
//                      get_invoice call returns real line detail), so no
//                      per-line signature is available. exact: same Contact
//                      + same Total + same calendar day. fuzzy: same
//                      Contact + same Total, within 1 day of an exact-tagged
//                      match (catches a same-batch entry a day either side).
//                      A recurring same-amount invoice spread weeks/months
//                      apart matches neither tier.
//   Spend/Receive    — BankTransactions: same BankAccount + same Contact +
//                      same Total + same Type, whole-group date span <=1 day
//                      to qualify at all (excludes recurring fixed-amount
//                      transactions, whose adjacent gaps can be short even
//                      though the whole series spans months). exact: members
//                      sharing the same calendar day within that group.
//                      fuzzy: the rest of the qualifying group.
//   Payments         — exact only: a Payment whose Invoice has more than
//                      one Payment against it ("paid twice"), or whose
//                      Invoice's total Payments exceed the Invoice's own
//                      Total (overpaid). Counts flagged payment records,
//                      not invoices.
//
// valueAtRisk sums AmountDue across flagged, still-unpaid (Status ==
// "AUTHORISED") Supplier Bills + Sales Invoices only — the only two
// categories with a genuine "unpaid amount" concept.
//
// periodDays (default 90) drops records older than that many days before
// matching runs, using each entity's own recency field (Contacts:
// UpdatedDateUTC; Invoices/BankTransactions/Payments: Date) — a client-side
// window over whatever's already been fetched, not a fresh server query
// (Xero tool-call params can't read a live filter value).
//
// matchMode ('exact' | 'exact_fuzzy' | 'fuzzy', default 'exact_fuzzy')
// selects which tagged tier(s) count toward each category's final total.
//
// statusMode ('open' | 'reviewed' | 'all', default 'open') — there's no
// "mark as reviewed" feature, so 'reviewed' honestly returns zero
// duplicates everywhere; 'open'/'all' both show everything currently
// flagged. Doesn't affect recordsScanned.
//
// detailRows returns one row per flagged record surviving the period/match
// filters — { category, label, detail, severity } — for a click-through
// drill-down table. Severity per row reuses the fixed per-category
// severity already shown on the category badges (Medium/High).
//
// Args: { contacts?: Contact[], invoices?: Invoice[],
//         bankTransactions?: BankTransaction[], payments?: Payment[],
//         periodDays?: number, matchMode?: string, statusMode?: string }
const analyze_duplicates = (args) => {
    const periodDays = Number(args.periodDays) > 0 ? Number(args.periodDays) : 90;
    const matchMode = ['exact', 'fuzzy'].includes(String(args.matchMode)) ? String(args.matchMode) : 'exact_fuzzy';
    const statusMode = ['reviewed', 'all'].includes(String(args.statusMode)) ? String(args.statusMode) : 'open';
    const tierAllowed = (tier) => matchMode === 'exact_fuzzy' || matchMode === tier;
    const now = Date.now();
    const withinPeriod = (raw) => {
        const ms = toEpochMs(raw);
        if (ms == null)
            return true; // no date on the record — don't exclude it
        return (now - ms) / 86_400_000 <= periodDays;
    };
    const rawContacts = Array.isArray(args.contacts) ? args.contacts : [];
    const rawInvoices = Array.isArray(args.invoices) ? args.invoices : [];
    const rawBankTx = Array.isArray(args.bankTransactions) ? args.bankTransactions : [];
    const rawPayments = Array.isArray(args.payments) ? args.payments : [];
    // Xero's list endpoints return VOIDED/DELETED historical records alongside
    // active ones (confirmed against real data: a genuinely voided bank
    // transaction and a deleted payment were both being treated as live
    // duplicates of their still-active counterpart). Invoices allow DRAFT/
    // SUBMITTED/AUTHORISED/PAID as legitimately active — only VOIDED/DELETED
    // are excluded. BankTransactions/Payments only have AUTHORISED/DELETED,
    // so only AUTHORISED counts.
    const isActiveInvoice = (inv) => !['VOIDED', 'DELETED'].includes(String(inv.Status ?? ''));
    const contacts = rawContacts.filter((c) => withinPeriod(c.UpdatedDateUTC));
    const invoices = rawInvoices.filter((inv) => isActiveInvoice(inv) && withinPeriod(inv.Date));
    const bankTx = rawBankTx.filter((tx) => tx.Status === 'AUTHORISED' && withinPeriod(tx.Date));
    const payments = rawPayments.filter((p) => p.Status === 'AUTHORISED' && withinPeriod(p.Date));
    const normEmail = (s) => String(s ?? '').toLowerCase().trim();
    const normTax = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const normName = (s) => String(s ?? '').toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
    const levenshteinRatio = (a, b) => {
        if (a === b)
            return 1;
        if (!a.length || !b.length)
            return 0;
        const m = a.length, n = b.length;
        const dp = new Array(n + 1);
        for (let j = 0; j <= n; j++)
            dp[j] = j;
        for (let i = 1; i <= m; i++) {
            let prev = dp[0];
            dp[0] = i;
            for (let j = 1; j <= n; j++) {
                const tmp = dp[j];
                dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
                prev = tmp;
            }
        }
        return 1 - dp[n] / Math.max(m, n);
    };
    const daysBetween = (a, b) => {
        const ma = toEpochMs(a);
        const mb = toEpochMs(b);
        if (ma == null || mb == null)
            return Infinity;
        return Math.abs(ma - mb) / 86_400_000;
    };
    const detailRows = [];
    // ── Contacts ─────────────────────────────────────────────────────
    // Union-Find over contact IDs: any two contacts linked by the SAME match
    // rule used for contactTier below (shared email/tax, or a fuzzy name hit)
    // are merged into one canonical cluster. Bills/Sales Invoices/Bank
    // Transactions use `canonicalContact()` instead of the raw Contact ID when
    // grouping, so an invoice split across two duplicate contact records (e.g.
    // "Acme" and "Acme Pty Ltd" both real records for the same vendor) still
    // gets matched against its counterpart under the sibling record — the
    // single biggest source of missed cross-category duplicates confirmed
    // against real data (a supplier's bills split across two near-duplicate
    // contact records were otherwise invisible to each other).
    const contactParent = new Map();
    const findContactRoot = (id) => {
        if (!contactParent.has(id))
            contactParent.set(id, id);
        let root = id;
        while (contactParent.get(root) !== root)
            root = contactParent.get(root);
        let cur = id;
        while (contactParent.get(cur) !== root) {
            const next = contactParent.get(cur);
            contactParent.set(cur, root);
            cur = next;
        }
        return root;
    };
    const unionContacts = (a, b) => {
        const ra = findContactRoot(a);
        const rb = findContactRoot(b);
        if (ra !== rb)
            contactParent.set(ra, rb);
    };
    const canonicalContact = (id) => (contactParent.has(id) ? findContactRoot(id) : id);
    const contactTier = new Map();
    const contactById = new Map();
    {
        const recs = contacts.map((c, i) => {
            const id = String(c.ContactID ?? i);
            contactById.set(id, c);
            return {
                id,
                name: normName(c.Name ?? `${c.FirstName ?? ''} ${c.LastName ?? ''}`),
                email: normEmail(c.EmailAddress),
                tax: normTax(c.TaxNumber),
            };
        });
        const groupBy = (key, minLen = 1) => {
            const map = new Map();
            for (const r of recs) {
                const k = key(r);
                if (k.length < minLen)
                    continue;
                (map.get(k) ?? map.set(k, []).get(k)).push(r.id);
            }
            return map;
        };
        for (const [, ids] of groupBy((r) => r.email)) {
            if (ids.length > 1) {
                ids.forEach((id) => contactTier.set(id, 'exact'));
                for (let i = 1; i < ids.length; i++)
                    unionContacts(ids[0], ids[i]);
            }
        }
        for (const [, ids] of groupBy((r) => r.tax)) {
            if (ids.length > 1) {
                ids.forEach((id) => contactTier.set(id, 'exact'));
                for (let i = 1; i < ids.length; i++)
                    unionContacts(ids[0], ids[i]);
            }
        }
        // Bucket EVERY named contact by first name-token — including ones
        // already tagged 'exact' — so an already-matched contact can still
        // serve as the anchor that catches a third, fuzzy-only variant (e.g.
        // two contacts share an exact email; a third, differently-spelled
        // variant with a DIFFERENT email is only findable by comparing it
        // against one of the first two). Only contacts not yet tagged get a
        // NEW tier assigned here — an already-'exact' contact's tag is never
        // downgraded, it just participates as a comparison target.
        const byToken = new Map();
        for (const r of recs) {
            if (!r.name)
                continue;
            const token = r.name.split(' ')[0];
            (byToken.get(token) ?? byToken.set(token, []).get(token)).push(r);
        }
        for (const [, bucket] of byToken) {
            for (let i = 0; i < bucket.length; i++) {
                for (let j = i + 1; j < bucket.length; j++) {
                    if (bucket[i].name === bucket[j].name)
                        continue;
                    if (levenshteinRatio(bucket[i].name, bucket[j].name) >= 0.82) {
                        if (!contactTier.has(bucket[i].id))
                            contactTier.set(bucket[i].id, 'fuzzy');
                        if (!contactTier.has(bucket[j].id))
                            contactTier.set(bucket[j].id, 'fuzzy');
                        unionContacts(bucket[i].id, bucket[j].id);
                    }
                }
            }
        }
    }
    const contactDup = new Set([...contactTier.entries()].filter(([, t]) => tierAllowed(t)).map(([id]) => id));
    for (const id of contactDup) {
        const c = contactById.get(id);
        detailRows.push({
            category: 'Contacts',
            label: String(c?.Name ?? 'Unknown'),
            detail: c?.EmailAddress ? String(c.EmailAddress) : 'Similar name',
            severity: 'Medium',
        });
    }
    // ── Invoices: split into Supplier Bills (ACCPAY) and Sales Invoices (ACCREC) ──
    const bills = invoices.filter((inv) => inv.Type === 'ACCPAY');
    const salesInv = invoices.filter((inv) => inv.Type === 'ACCREC');
    const invoiceById = new Map();
    for (const inv of invoices)
        invoiceById.set(String(inv.InvoiceID ?? ''), inv);
    const billTier = new Map();
    {
        const recs = bills.map((inv) => ({
            id: String(inv.InvoiceID ?? ''),
            contactId: String(inv.Contact?.ContactID ?? ''),
            total: inv.Total,
            // A blank InvoiceNumber is common (many bills are entered with no
            // reference at all) — matching on it anyway collapsed every
            // no-reference bill from the same supplier into one false "exact"
            // group regardless of amount or date (confirmed against real data: two
            // entirely unrelated bills, different totals months apart, were both
            // blank-numbered and got flagged purely for that). Only a genuinely
            // shared, non-blank number counts as an exact match.
            num: String(inv.InvoiceNumber ?? '').trim(),
            date: inv.Date,
        }));
        // Pass 1 — same RAW contact (no cross-contact inference yet).
        const byContactNum = new Map();
        const byContactTotal = new Map();
        for (const r of recs) {
            if (r.num) {
                const numKey = `${r.contactId}|${r.num}`;
                (byContactNum.get(numKey) ?? byContactNum.set(numKey, []).get(numKey)).push(r);
            }
            const totalKey = `${r.contactId}|${r.total ?? ''}`;
            (byContactTotal.get(totalKey) ?? byContactTotal.set(totalKey, []).get(totalKey)).push(r);
        }
        for (const [, group] of byContactNum)
            if (group.length > 1)
                group.forEach((r) => billTier.set(r.id, 'exact'));
        // Same contact + same Total + the SAME calendar day => fuzzy (this is
        // the 'exact' tier's InvoiceNumber signal missing, so it never counts
        // above fuzzy). A recurring fixed-amount bill (e.g. a weekly
        // cleaning-service invoice, confirmed in real data landing exactly 7
        // days apart every time) shares contact+total with many OTHER
        // legitimate instances of itself — requiring the SAME day, not just
        // "within N days", is what keeps that recurring series out (confirmed:
        // every genuine fuzzy match in real data was same-day; a same-contact
        // match landing even a day off the same total was confirmed, via the
        // matching Sales Invoices case, to be a coincidence, not a duplicate).
        for (const [, group] of byContactTotal) {
            if (group.length < 2)
                continue;
            const byDay = new Map();
            for (const r of group) {
                const ms = toEpochMs(r.date);
                if (ms == null)
                    continue;
                const dayKey = String(Math.floor(ms / 86_400_000));
                (byDay.get(dayKey) ?? byDay.set(dayKey, []).get(dayKey)).push(r);
            }
            for (const [, ids] of byDay) {
                if (ids.length > 1)
                    ids.forEach((r) => { if (!billTier.has(r.id))
                        billTier.set(r.id, 'fuzzy'); });
            }
        }
        // Pass 2 — cross the contact boundary using canonicalContact, but ONLY
        // for bills not already tagged above, and NEVER above 'fuzzy': a match
        // that only exists because two Contact records are themselves flagged
        // as duplicates is a two-hop inference, not a same-record fact, even
        // when the invoice number or total+date line up exactly (confirmed
        // against real data: a supplier's bill entered under its "Pty Ltd"
        // duplicate contact record, same invoice number/total/date as the
        // canonical exact pair — a real match, but one hop weaker than the
        // pair itself).
        const byCanonNum = new Map();
        const byCanonTotal = new Map();
        for (const r of recs) {
            const canon = canonicalContact(r.contactId);
            if (r.num) {
                const numKey = `${canon}|${r.num}`;
                (byCanonNum.get(numKey) ?? byCanonNum.set(numKey, []).get(numKey)).push(r);
            }
            const totalKey = `${canon}|${r.total ?? ''}`;
            (byCanonTotal.get(totalKey) ?? byCanonTotal.set(totalKey, []).get(totalKey)).push(r);
        }
        for (const [, group] of byCanonNum) {
            if (!group.some((r) => billTier.get(r.id) === 'exact'))
                continue;
            group.forEach((r) => { if (!billTier.has(r.id))
                billTier.set(r.id, 'fuzzy'); });
        }
        for (const [, group] of byCanonTotal) {
            const exactRecs = group.filter((r) => billTier.get(r.id) === 'exact');
            if (exactRecs.length === 0)
                continue;
            for (const r of group) {
                if (billTier.has(r.id))
                    continue;
                const rDay = toEpochMs(r.date);
                if (rDay == null)
                    continue;
                const rDayKey = Math.floor(rDay / 86_400_000);
                const crossContactSameDay = exactRecs.some((e) => {
                    if (e.contactId === r.contactId)
                        return false;
                    const eDay = toEpochMs(e.date);
                    return eDay != null && Math.floor(eDay / 86_400_000) === rDayKey;
                });
                if (crossContactSameDay)
                    billTier.set(r.id, 'fuzzy');
            }
        }
    }
    const billDup = new Set([...billTier.entries()].filter(([, t]) => tierAllowed(t)).map(([id]) => id));
    for (const id of billDup) {
        const inv = invoiceById.get(id);
        const contact = inv?.Contact;
        detailRows.push({
            category: 'Supplier Bills',
            label: `${inv?.InvoiceNumber || id} — ${contact?.Name ?? 'Unknown'}`,
            detail: `$${Number(inv?.Total ?? 0).toFixed(2)}`,
            severity: 'High',
        });
    }
    const salesInvTier = new Map();
    {
        const recs = salesInv.map((inv) => ({
            id: String(inv.InvoiceID ?? ''),
            contactId: String(inv.Contact?.ContactID ?? ''),
            total: inv.Total,
            date: inv.Date,
        }));
        const dayKeyOf = (date) => {
            const ms = toEpochMs(date);
            return ms == null ? null : String(Math.floor(ms / 86_400_000));
        };
        // Pass 1 — same RAW contact, same calendar day => exact. Nothing else.
        const byContactTotal = new Map();
        for (const r of recs) {
            const key = `${r.contactId}|${r.total ?? ''}`;
            (byContactTotal.get(key) ?? byContactTotal.set(key, []).get(key)).push(r);
        }
        for (const [, group] of byContactTotal) {
            if (group.length < 2)
                continue;
            const byDay = new Map();
            for (const r of group) {
                const dayKey = dayKeyOf(r.date);
                if (dayKey == null)
                    continue;
                (byDay.get(dayKey) ?? byDay.set(dayKey, []).get(dayKey)).push(r);
            }
            for (const [, ids] of byDay)
                if (ids.length > 1)
                    ids.forEach((r) => salesInvTier.set(r.id, 'exact'));
        }
        // Pass 2 — cross the contact boundary via canonicalContact, but ONLY for
        // an untagged invoice sharing the EXACT SAME calendar day (not "within N
        // days") as an exact-tagged record under a DIFFERENT raw Contact, and
        // NEVER tagged above 'fuzzy': a match that only exists because the two
        // Contact records are themselves flagged as duplicates is one hop
        // weaker than a same-record match (confirmed against real data — an
        // invoice entered under a supplier's "Pty Ltd" duplicate contact record,
        // same total/date as the canonical exact pair).
        const byCanonTotal = new Map();
        for (const r of recs) {
            const key = `${canonicalContact(r.contactId)}|${r.total ?? ''}`;
            (byCanonTotal.get(key) ?? byCanonTotal.set(key, []).get(key)).push(r);
        }
        for (const [, group] of byCanonTotal) {
            const exactRecs = group.filter((r) => salesInvTier.get(r.id) === 'exact');
            if (exactRecs.length === 0)
                continue;
            for (const r of group) {
                if (salesInvTier.has(r.id))
                    continue;
                const rDay = dayKeyOf(r.date);
                if (rDay != null && exactRecs.some((e) => e.contactId !== r.contactId && dayKeyOf(e.date) === rDay)) {
                    salesInvTier.set(r.id, 'fuzzy');
                }
            }
        }
    }
    const salesInvDup = new Set([...salesInvTier.entries()].filter(([, t]) => tierAllowed(t)).map(([id]) => id));
    for (const id of salesInvDup) {
        const inv = invoiceById.get(id);
        const contact = inv?.Contact;
        detailRows.push({
            category: 'Sales Invoices',
            label: `${inv?.InvoiceNumber || id} — ${contact?.Name ?? 'Unknown'}`,
            detail: `$${Number(inv?.Total ?? 0).toFixed(2)}`,
            severity: 'Medium',
        });
    }
    // ── Bank transactions ────────────────────────────────────────────
    // Matches on the WHOLE GROUP's date span (max - min <= 1 day), not
    // same-day-only pairwise matching. A recurring fixed-amount transaction
    // (a weekly/fortnightly fee, a regular supplier payment) shares
    // account+contact+total with many OTHER instances of itself, and its
    // ADJACENT gaps can legitimately be as short as 1-2 days even though the
    // whole series spans months (confirmed against real data: a recurring
    // fee's own adjacent-day gaps were mostly 1-2 days across a 16-transaction,
    // 25-day-spanning series) — so pairwise/adjacent-only day-window matching
    // still chains a long recurring series together. A genuine duplicate
    // cluster (the same line double- or triple-keyed) is instead tightly
    // bunched as a WHOLE: every member falls within about a day of every
    // other member, not just of its nearest neighbour. Confirmed against real
    // data: a genuine 3-way duplicate (2 same-day + 1 exactly one day later)
    // has a whole-group span of 1 day; every recurring series in this dataset
    // spans 25-70+ days even though individual gaps are short.
    // Also excludes transactions with no Contact set at all — Xero commonly
    // leaves bank lines uncoded, and treating "blank" as a match value would
    // wrongly group unrelated uncoded transactions that just share an amount.
    const bankTxTier = new Map();
    const bankTxById = new Map();
    {
        const recs = [];
        for (const tx of bankTx) {
            const id = String(tx.BankTransactionID ?? '');
            bankTxById.set(id, tx);
            const contactId = String(tx.Contact?.ContactID ?? '');
            if (!contactId)
                continue;
            const accountId = String(tx.BankAccount?.AccountID ?? '');
            recs.push({ id, contactId, accountId, total: tx.Total, type: String(tx.Type ?? ''), date: tx.Date });
        }
        // Within a tightly-bunched (whole-group span <=1 day) candidate group,
        // members sharing the SAME calendar day are a genuine exact duplicate; a
        // member landing up to a day off from an exact-tagged pair is the
        // softer, still-likely case. Every member of a qualifying group is
        // within 1 day of every other member by construction, so anyone not
        // absorbed into a same-day exact pair still counts as fuzzy.
        const tierSpanGroup = (group) => {
            if (group.length < 2)
                return;
            const times = group.map((r) => toEpochMs(r.date)).filter((t) => t != null);
            if (times.length < 2)
                return;
            const spanDays = (Math.max(...times) - Math.min(...times)) / 86_400_000;
            if (spanDays > 1)
                return;
            const byDay = new Map();
            for (const r of group) {
                const ms = toEpochMs(r.date);
                if (ms == null)
                    continue;
                const dayKey = String(Math.floor(ms / 86_400_000));
                (byDay.get(dayKey) ?? byDay.set(dayKey, []).get(dayKey)).push(r);
            }
            for (const [, ids] of byDay)
                if (ids.length > 1)
                    ids.forEach((r) => bankTxTier.set(r.id, 'exact'));
            for (const r of group)
                if (!bankTxTier.has(r.id))
                    bankTxTier.set(r.id, 'fuzzy');
        };
        // Pass 1 — same RAW contact.
        // Include Type — a RECEIVE and a SPEND that happen to share the same
        // amount are opposite-direction transactions, not duplicates of each
        // other (confirmed against real data: a $39.50 RECEIVE and a $39.50
        // SPEND were otherwise being matched purely on coincidental amount).
        const byKey = new Map();
        for (const r of recs) {
            const key = `${r.accountId}|${r.contactId}|${r.total ?? ''}|${r.type}`;
            (byKey.get(key) ?? byKey.set(key, []).get(key)).push(r);
        }
        for (const [, group] of byKey)
            tierSpanGroup(group);
        // Pass 2 — cross the contact boundary via canonicalContact, but ONLY for
        // transactions not already tagged, and NEVER above 'fuzzy' (same
        // reasoning as the Bills/Sales Invoices pass 2 above).
        const byCanonKey = new Map();
        for (const r of recs) {
            const key = `${r.accountId}|${canonicalContact(r.contactId)}|${r.total ?? ''}|${r.type}`;
            (byCanonKey.get(key) ?? byCanonKey.set(key, []).get(key)).push(r);
        }
        for (const [, group] of byCanonKey) {
            const exactRecs = group.filter((r) => bankTxTier.get(r.id) === 'exact');
            if (exactRecs.length === 0)
                continue;
            for (const r of group) {
                if (bankTxTier.has(r.id))
                    continue;
                if (exactRecs.some((e) => daysBetween(r.date, e.date) <= 1))
                    bankTxTier.set(r.id, 'fuzzy');
            }
        }
    }
    const bankTxDup = new Set([...bankTxTier.entries()].filter(([, t]) => tierAllowed(t)).map(([id]) => id));
    for (const id of bankTxDup) {
        const tx = bankTxById.get(id);
        const account = tx?.BankAccount;
        detailRows.push({
            category: 'Spend / Receive Money',
            label: `${account?.Name ?? 'Bank'} — $${Number(tx?.Total ?? 0).toFixed(2)}`,
            detail: String(tx?.Type ?? ''),
            severity: 'Medium',
        });
    }
    // ── Payments ─────────────────────────────────────────────────────
    const paymentTier = new Map();
    const paymentById = new Map();
    {
        const invoiceTotalById = new Map();
        for (const inv of rawInvoices) {
            if (!isActiveInvoice(inv))
                continue;
            invoiceTotalById.set(String(inv.InvoiceID ?? ''), Number(inv.Total) || 0);
        }
        const byInvoice = new Map();
        for (const p of payments) {
            const id = String(p.PaymentID ?? '');
            paymentById.set(id, p);
            const invoiceId = String(p.Invoice?.InvoiceID ?? '');
            if (!invoiceId)
                continue; // no shared invoice to group unrelated payments by
            const amount = Number(p.Amount) || 0;
            (byInvoice.get(invoiceId) ?? byInvoice.set(invoiceId, []).get(invoiceId)).push({ id, amount });
        }
        // Flag only genuine overpayment (sum of payments > invoice Total) — NOT
        // "more than one payment against this invoice" alone, which also
        // matches entirely legitimate split/installment payments (e.g. two
        // differing-amount instalments that together equal the invoice Total).
        // Confirmed against real data: every actual duplicate case here is two
        // IDENTICAL-amount payments that together exceed the Total; the two
        // false positives this replaces were differing-amount instalments that
        // summed to exactly the Total.
        for (const [invoiceId, group] of byInvoice) {
            const total = invoiceTotalById.get(invoiceId) ?? 0;
            const sum = group.reduce((s, p) => s + p.amount, 0);
            if (total > 0 && sum > total) {
                group.forEach((p) => paymentTier.set(p.id, 'exact'));
            }
        }
    }
    const paymentDup = new Set([...paymentTier.entries()].filter(([, t]) => tierAllowed(t)).map(([id]) => id));
    for (const id of paymentDup) {
        const p = paymentById.get(id);
        detailRows.push({
            category: 'Payments',
            label: `${p?.Reference || 'Payment'} — $${Number(p?.Amount ?? 0).toFixed(2)}`,
            detail: String(p?.PaymentType ?? ''),
            severity: 'High',
        });
    }
    const valueAtRisk = [...bills, ...salesInv]
        .filter((inv) => billDup.has(String(inv.InvoiceID ?? '')) || salesInvDup.has(String(inv.InvoiceID ?? '')))
        .filter((inv) => inv.Status === 'AUTHORISED')
        .reduce((sum, inv) => sum + (Number(inv.AmountDue) || 0), 0);
    // Exact vs likely split — a record's own tier is fixed, but only counted
    // here if matchMode currently allows it (mirrors how contactDup/billDup/etc.
    // are themselves built), so e.g. selecting "Exact only" correctly zeroes
    // out every category's likelyCount rather than showing a stale split.
    const tierCounts = (tier) => {
        let exact = 0, likely = 0;
        for (const t of tier.values()) {
            if (t === 'exact' && tierAllowed('exact'))
                exact++;
            if (t === 'fuzzy' && tierAllowed('fuzzy'))
                likely++;
        }
        return { exact, likely };
    };
    const contactTierCounts = tierCounts(contactTier);
    const billTierCounts = tierCounts(billTier);
    const salesInvTierCounts = tierCounts(salesInvTier);
    const bankTxTierCounts = tierCounts(bankTxTier);
    const paymentTierCounts = tierCounts(paymentTier);
    const exactCount = contactTierCounts.exact + billTierCounts.exact + salesInvTierCounts.exact + bankTxTierCounts.exact + paymentTierCounts.exact;
    const likelyCount = contactTierCounts.likely + billTierCounts.likely + salesInvTierCounts.likely + bankTxTierCounts.likely + paymentTierCounts.likely;
    const totalDuplicates = contactDup.size + billDup.size + salesInvDup.size + bankTxDup.size + paymentDup.size;
    const recordsScanned = rawContacts.length + rawInvoices.length + rawBankTx.length + rawPayments.length;
    // Only stamped fresh when this recompute was triggered by an actual Xero
    // fetch landing (mount, chained cascade, or a Rescan click re-firing the
    // chain) — NOT by a filter dropdown change, which just re-filters data
    // already in hand without querying Xero again. Filter-only callers pass
    // the current `/ui/dup/lastScannedAt` through as `existingScannedAt` so
    // "Last scanned" doesn't misleadingly jump to "just now" on a plain
    // client-side re-filter.
    const lastScannedAt = typeof args.existingScannedAt === 'string' && args.existingScannedAt
        ? args.existingScannedAt
        : new Date().toISOString();
    if (statusMode === 'reviewed') {
        return {
            contacts: { count: 0, exactCount: 0, likelyCount: 0 },
            supplierBills: { count: 0, exactCount: 0, likelyCount: 0 },
            salesInvoices: { count: 0, exactCount: 0, likelyCount: 0 },
            bankTx: { count: 0, exactCount: 0, likelyCount: 0 },
            payments: { count: 0, exactCount: 0, likelyCount: 0 },
            totalDuplicates: 0,
            exactCount: 0,
            likelyCount: 0,
            valueAtRisk: 0,
            recordsScanned,
            detailRows: [],
            lastScannedAt,
        };
    }
    return {
        contacts: { count: contactDup.size, exactCount: contactTierCounts.exact, likelyCount: contactTierCounts.likely },
        supplierBills: { count: billDup.size, exactCount: billTierCounts.exact, likelyCount: billTierCounts.likely },
        salesInvoices: { count: salesInvDup.size, exactCount: salesInvTierCounts.exact, likelyCount: salesInvTierCounts.likely },
        bankTx: { count: bankTxDup.size, exactCount: bankTxTierCounts.exact, likelyCount: bankTxTierCounts.likely },
        payments: { count: paymentDup.size, exactCount: paymentTierCounts.exact, likelyCount: paymentTierCounts.likely },
        totalDuplicates,
        exactCount,
        likelyCount,
        valueAtRisk,
        recordsScanned,
        detailRows,
        lastScannedAt,
    };
};
// ── analyze_excluded_documents ─────────────────────────────────────────
// Flags Xero invoices/bills that sit outside standard P&L reporting:
// Voided, Deleted, or a Draft older than `staleDraftDays` (default 30).
// Unlike Sales Invoice/Bill duplicate matching elsewhere in this file, all
// three signals here are real Status/Date fields on Xero's list-level
// Invoice payload — no per-line LineItems limitation applies to this check.
//
// detailRows is sorted most-recent-Date-first; detailRowCount lets the
// spec conditionally show/hide preview rows without a $computed inside a
// `visible` condition (not supported — visible only reads a literal
// $state value with eq/gt/etc modifiers).
//
// Args: { invoices?: Invoice[], staleDraftDays?: number }
const analyze_excluded_documents = (args) => {
    const staleDraftDays = Number(args.staleDraftDays) > 0 ? Number(args.staleDraftDays) : 30;
    const invoices = Array.isArray(args.invoices) ? args.invoices : [];
    const now = Date.now();
    const ageDays = (raw) => {
        const ms = toEpochMs(raw);
        return ms == null ? 0 : (now - ms) / 86_400_000;
    };
    const voided = invoices.filter((inv) => inv.Status === 'VOIDED');
    const deleted = invoices.filter((inv) => inv.Status === 'DELETED');
    const staleDrafts = invoices.filter((inv) => inv.Status === 'DRAFT' && ageDays(inv.Date) > staleDraftDays);
    const label = (inv) => {
        const contact = inv.Contact;
        const contactName = String(contact?.Name ?? 'Unknown');
        const num = String(inv.InvoiceNumber ?? '').trim();
        if (num)
            return `${num} · ${contactName}`;
        return `${inv.Type === 'ACCPAY' ? 'Bill' : 'Invoice'} · ${contactName}`;
    };
    const tagged = [
        ...voided.map((inv) => ({ label: label(inv), badgeText: 'Voided', badgeTone: 'destructive', date: inv.Date })),
        ...deleted.map((inv) => ({ label: label(inv), badgeText: 'Deleted', badgeTone: 'muted', date: inv.Date })),
        ...staleDrafts.map((inv) => ({
            label: label(inv),
            badgeText: `Draft ${Math.round(ageDays(inv.Date))}d`,
            badgeTone: 'warning',
            date: inv.Date,
        })),
    ];
    tagged.sort((a, b) => (toEpochMs(b.date) ?? 0) - (toEpochMs(a.date) ?? 0));
    const totalValue = [...voided, ...deleted, ...staleDrafts].reduce((sum, inv) => sum + (Number(inv.Total) || 0), 0);
    return {
        voidedCount: voided.length,
        deletedCount: deleted.length,
        staleCount: staleDrafts.length,
        totalCount: voided.length + deleted.length + staleDrafts.length,
        totalValue,
        detailRowCount: tagged.length,
        detailRows: tagged.map(({ label: l, badgeText, badgeTone }) => ({ label: l, badgeText, badgeTone })),
    };
};
// ── ready_to_pay_held ───────────────────────────────────────────────
// Adds `pills` (one display label per failed check) to each held bill from
// list_xero_ready_to_pay, so the tile can render one Badge per reason via
// positional `$item: "pills/0"` … `"pills/2"` (repeat has no nested lists).
// Returns one object for a single setState: { bills }.
// Args: { value: ReadyToPayBill[] }
const HELD_REASON_PILL = {
    not_approved: '✕ not approved',
    bank: '✕ bank',
    rate: '✕ rate',
};
const ready_to_pay_held = (args) => {
    const bills = Array.isArray(args.value) ? args.value : [];
    return {
        bills: bills.map((b) => ({
            ...b,
            pills: (Array.isArray(b.reasons) ? b.reasons : [])
                .map((r) => HELD_REASON_PILL[String(r)] ?? `✕ ${String(r).replace(/_/g, ' ')}`),
        })),
    };
};
// ── rate_variance_rows ──────────────────────────────────────────────
// Lays out list_xero_rate_variance lines as diverging bars around 0.
// There's no diverging-bar primitive, so each half of a row's bar track is a
// grid Row whose `template` (grid-template-columns) sizes three solid fills:
//   left  half: [spacer | tolerance band | under bar]   (bar touches centre)
//   right half: [over bar | tolerance band | spacer]
// Units are "fr" out of 100 per half, where 100 = the axis limit (`scale`).
// Returns one object for a single setState: { rows, axisMin, axisMax }.
// Args: { value: RateVarianceLine[], tolerance?: number (default 5), limit?: number (default 8) }
const rate_variance_rows = (args) => {
    const lines = Array.isArray(args.value) ? args.value : [];
    const tolerance = Math.max(0, Number(args.tolerance) || 5);
    const limit = Math.max(1, Math.floor(Number(args.limit) || 8));
    const shown = lines.slice(0, limit);
    // Axis: at least ±20%, else the largest variance rounded up to the next 10%
    const maxAbs = Math.max(0, ...shown.map((l) => Math.abs(Number(l.variancePct) || 0)));
    const scale = Math.max(20, Math.ceil(maxAbs / 10) * 10);
    const pct = (n) => Math.min(100, Math.max(0, (n / scale) * 100));
    const fr = (...cols) => cols.map((c) => `${Math.round(c * 100) / 100}fr`).join(' ');
    const tol = pct(tolerance);
    const rows = shown.map((l) => {
        const v = Number(l.variancePct) || 0;
        const bar = pct(Math.abs(v));
        const band = Math.max(0, tol - bar);
        const over = v > 0;
        const under = v < 0;
        return {
            ...l,
            // Left (under) half: spacer, band, bar — the bar sits against the centre line
            leftTemplate: under ? fr(100 - bar - band, band, bar) : fr(100 - tol, tol, 0),
            // Right (over) half: bar, band, spacer
            rightTemplate: over ? fr(bar, band, 100 - bar - band) : fr(0, tol, 100 - tol),
        };
    });
    return { rows, axisMin: `−${scale}%`, axisMax: `+${scale}%` };
};
// ── paginate ─────────────────────────────────────────────────────────
// Client-side paging over a list already in state. `repeat` only accepts a
// static statePath, so widgets `setState` the returned object into a UI path
// (on data load via `watch`, and from Prev/Next clicks) and repeat over
// `<path>/items`. Returns one object so a single setState writes everything —
// json-render's watch loop cancels after the first state write, so chained
// setStates would silently drop all but the first.
// Args: { value: array, page?: number, delta?: number, size?: number (default 30) }
// Returns: { items, page, label, hasPrev, hasNext, hasPages }
const paginate = (args) => {
    const all = Array.isArray(args.value) ? args.value : [];
    const size = Math.max(1, Math.floor(Number(args.size) || 30));
    const pageCount = Math.max(1, Math.ceil(all.length / size));
    const requested = Math.floor(Number(args.page) || 0) + Math.floor(Number(args.delta) || 0);
    const page = Math.min(Math.max(requested, 0), pageCount - 1);
    const from = page * size;
    const to = Math.min(all.length, from + size);
    return {
        items: all.slice(from, to),
        page,
        label: all.length ? `${from + 1}–${to} of ${all.length}` : '',
        hasPrev: page > 0,
        hasNext: page < pageCount - 1,
        hasPages: pageCount > 1,
    };
};
// ── analyze_bill_duplicates ──────────────────────────────────────────
// Flags Xero ACCPAY bills that look like accidental double-entries: same
// REAL vendor + same amount, dated within a few days of each other,
// scanned over a rolling window (default 30 days). Same-day matches
// (span 0) are tiered "Exact"; 1-6 days apart is "Near". A same-
// vendor/amount pair spanning 7+ days is treated as a normal recurring
// charge (weekly/monthly service fees, subscriptions) and NOT flagged —
// confirmed against this org's real data (e.g. MCO Cleaning Services'
// weekly $220 invoice would otherwise false-positive).
//
// "Same vendor" is resolved via the contacts list (email, falling back to
// phone, falling back to raw name), NOT by the bill's embedded Contact.Name
// alone — confirmed against real data that one vendor can have two
// separate Xero contact records under slightly different legal names
// (e.g. "DCT Sunset Office Supplies" vs "...Pty Ltd") sharing the same
// email/phone. Grouping by name alone silently dropped that second
// record's bill from the cluster. The group's display name is the most
// frequent raw name among its bills (a tie keeps the first seen).
// `organisation` is the raw get_organisation response — used only to pull
// the real ShortCode needed for Xero's documented deep-link format
// (https://go.xero.com/organisationlogin/default.aspx?shortcode=...&
// redirecturl=/AccountsPayable/Edit.aspx?InvoiceID=...) — a bare
// /AccountsPayable/... URL with no shortcode/org context 404s/errors,
// confirmed live.
// Args: { invoices?: Invoice[], contacts?: Contact[], organisation?: unknown, windowDays?: number, expandedGroupId?: string, clickedGroupId?: string }
const analyze_bill_duplicates = (args) => {
    const invoices = Array.isArray(args.invoices) ? args.invoices : [];
    const contacts = Array.isArray(args.contacts) ? args.contacts : [];
    const windowDays = Number(args.windowDays) > 0 ? Number(args.windowDays) : 30;
    const org = args.organisation ?? {};
    const orgs = Array.isArray(org.Organisations) ? org.Organisations : [];
    const shortCode = String(orgs[0]?.ShortCode ?? '');
    const parseDate = (raw) => {
        const m = String(raw ?? '').match(/\/Date\((-?\d+)(?:[+-]\d{4})?\)\//);
        return m ? Number(m[1]) : NaN;
    };
    const fmtAmt = (n) => {
        const v = Number(n);
        if (!Number.isFinite(v))
            return '';
        return '$' + new Intl.NumberFormat('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
    };
    const fmtDate = (ms) => {
        if (!Number.isFinite(ms))
            return '';
        return new Date(ms).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
    };
    // ContactID -> resolved vendor identity (email > phone > name), built
    // from the full contacts list (which carries Email/Phones — the bill's
    // own embedded Contact object doesn't).
    const identityByContactId = new Map();
    for (const c of contacts) {
        const contactId = String(c.ContactID ?? '');
        if (!contactId)
            continue;
        const email = String(c.EmailAddress ?? '').trim().toLowerCase();
        let identity = email ? `email:${email}` : '';
        if (!identity) {
            const phones = Array.isArray(c.Phones) ? c.Phones : [];
            const phone = phones
                .map((p) => `${String(p.PhoneAreaCode ?? '')}${String(p.PhoneNumber ?? '')}`)
                .find((p) => p.replace(/\D/g, '').length >= 3);
            identity = phone ? `phone:${phone}` : `name:${String(c.Name ?? '').trim().toLowerCase()}`;
        }
        identityByContactId.set(contactId, identity);
    }
    const resolveIdentity = (contact) => {
        const contactId = String(contact?.ContactID ?? '');
        return identityByContactId.get(contactId) ?? `name:${String(contact?.Name ?? 'Unknown').trim().toLowerCase()}`;
    };
    const cutoff = Date.now() - windowDays * 86_400_000;
    const bills = invoices.filter((i) => {
        if (i.Type !== 'ACCPAY' || i.Status === 'VOIDED' || i.Status === 'DELETED')
            return false;
        const t = parseDate(i.Date);
        return Number.isFinite(t) && t >= cutoff;
    });
    const groups = new Map();
    for (const b of bills) {
        const contact = b.Contact;
        const key = `${resolveIdentity(contact)}|${Number(b.Total) || 0}`;
        (groups.get(key) ?? groups.set(key, []).get(key)).push(b);
    }
    const displayName = (arr) => {
        const counts = new Map();
        for (const b of arr) {
            const name = String(b.Contact?.Name ?? 'Unknown');
            counts.set(name, (counts.get(name) ?? 0) + 1);
        }
        return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Unknown';
    };
    const flagged = [];
    for (const [, arr] of groups) {
        if (arr.length < 2)
            continue;
        const sorted = [...arr].sort((a, b) => parseDate(a.Date) - parseDate(b.Date));
        const spanDays = Math.round((parseDate(sorted[sorted.length - 1].Date) - parseDate(sorted[0].Date)) / 86_400_000);
        if (spanDays > 6)
            continue; // normal recurring charge, not a duplicate
        flagged.push({ contact: displayName(sorted), tier: spanDays === 0 ? 'exact' : 'near', spanDays, bills: sorted });
    }
    flagged.sort((a, b) => (a.tier === b.tier ? 0 : a.tier === 'exact' ? -1 : 1));
    const exactCount = flagged.filter((g) => g.tier === 'exact').reduce((s, g) => s + g.bills.length, 0);
    const nearCount = flagged.filter((g) => g.tier === 'near').reduce((s, g) => s + g.bills.length, 0);
    // One compact row per duplicate GROUP (not per bill) — contact + amount,
    // then a tiered detail line. For an exact (same-day) group, the detail
    // names the distinct invoice-number variants involved (e.g. "BSE-7001 vs
    // BSE7001") — this IS the explanation: those numbers colliding on the
    // same contact/amount/day is why it's flagged. When a group has more
    // bills than distinct number variants (e.g. "BSE-7001" entered twice
    // plus "BSE7001"), the bill count is appended for clarity. A near
    // (1-6 days apart) group instead states the count + day span, since
    // there's no number collision to point at.
    // `clickedGroupId` is only present when a row's own click triggered this
    // recompute — toggles that row's expanded state against whatever was
    // previously expanded (read back from state as `expandedGroupId`, same
    // echo-and-compare pattern as analyze_myob_duplicates' `filter`). A
    // background data refresh (list_invoices/list_contacts/get_organisation
    // re-arriving) omits `clickedGroupId` entirely, so it just preserves
    // whatever was already expanded instead of collapsing it.
    const prevExpandedGroupId = String(args.expandedGroupId ?? '');
    const clickedGroupId = args.clickedGroupId !== undefined ? String(args.clickedGroupId) : undefined;
    const expandedGroupId = clickedGroupId !== undefined ? (clickedGroupId === prevExpandedGroupId ? '' : clickedGroupId) : prevExpandedGroupId;
    const detailRows = flagged.map((g, i) => {
        const amount = fmtAmt(g.bills[0]?.Total);
        const groupId = `${g.contact}|${amount}`;
        const uniqueNumbers = [...new Set(g.bills.map((b) => String(b.InvoiceNumber ?? '—')))];
        let detail;
        if (g.tier === 'exact') {
            detail = uniqueNumbers.length >= 2 ? uniqueNumbers.slice(0, 2).join(' vs ') : uniqueNumbers[0] ?? '';
            if (g.bills.length > uniqueNumbers.length || g.bills.length > 2)
                detail += ` (${g.bills.length} bills)`;
        }
        else {
            detail = `${g.bills.length} bills, ${g.spanDays} day${g.spanDays !== 1 ? 's' : ''} apart`;
        }
        // One line per actual bill in this group — shown only when the row is
        // expanded (clicked). preserveLines renders this as a real multi-line
        // block rather than relying on nested `repeat` (not confirmed supported
        // inside an already-repeated template in this renderer).
        const billsSummary = g.bills
            .map((b) => `${String(b.InvoiceNumber ?? '—')} · ${fmtDate(parseDate(b.Date))} · ${fmtAmt(b.Total)}`)
            .join('\n');
        return {
            groupId,
            contact: g.contact,
            amount,
            tierLabel: g.tier === 'exact' ? 'Exact match' : 'Near match',
            tierTone: g.tier === 'exact' ? 'destructive' : 'warning',
            detail,
            isLast: i === flagged.length - 1,
            expanded: groupId === expandedGroupId,
            billsSummary,
        };
    });
    const firstFlaggedInvoiceId = String(flagged[0]?.bills[0]?.InvoiceID ?? '');
    const reviewUrl = shortCode
        ? `https://go.xero.com/organisationlogin/default.aspx?shortcode=${encodeURIComponent(shortCode)}&redirecturl=${encodeURIComponent(firstFlaggedInvoiceId ? `/AccountsPayable/Edit.aspx?InvoiceID=${firstFlaggedInvoiceId}` : '/AccountsPayable/Bills')}`
        : 'https://go.xero.com/';
    return {
        groupCount: flagged.length,
        billCount: exactCount + nearCount,
        exactCount,
        nearCount,
        clearCount: bills.length - exactCount - nearCount,
        totalScanned: bills.length,
        reviewUrl,
        expandedGroupId,
        detailRows,
        scannedAt: new Date().toISOString(),
    };
};
// ── time_ago ──────────────────────────────────────────────────────────
// Formats an ISO timestamp as a short relative-time string: "just now",
// "N min ago", "N hrs ago", "N days ago".
// Args: { value: string }
const time_ago = (args) => {
    const t = new Date(String(args.value ?? '')).getTime();
    if (!Number.isFinite(t))
        return '';
    const mins = Math.floor((Date.now() - t) / 60_000);
    if (mins < 1)
        return 'just now';
    if (mins < 60)
        return `${mins} min ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24)
        return `${hours} hr${hours !== 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
};
// ── Bill Entry (record + validate a draft bill) ──────────────────────
// Helpers for the "Bill-Entry" tile: a form that builds a raw Xero
// invoice body (Type ACCPAY, Status DRAFT) from user input and submits
// it via create_invoice. No `checks` prop validation exists on this
// system's current TextInput/NumberInput/Select/DateInput components
// (confirmed against widgets-system/system/components.tsx — the
// underlying @json-render/core library supports a `checks` config, but
// no component here declares the prop), so validation is done here:
// bill_entry_is_invalid gates the submit button's `disabled` (a real
// boolean return — NOT a bare `$or`/`$and`, which only evaluate inside
// a `visible` condition and pass through as a literal truthy object
// anywhere else, exactly the bug already hit and fixed on the
// ApprovalMax Pending Approvals tile's Table `loading` prop).
function formatAUD(value) {
    try {
        return new Intl.NumberFormat('en-AU', {
            style: 'currency',
            currency: 'AUD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    }
    catch {
        return `$${value.toFixed(2)}`;
    }
}
/** Appends one blank editable row. `id` is a client-only row key (never sent to Xero). */
const bill_entry_add_line = (args) => {
    const lines = Array.isArray(args.lines) ? args.lines : [];
    const id = `line-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    return [...lines, { id, description: '', quantity: 1, unitAmount: 0, accountCode: '', taxType: '' }];
};
/** quantity * unitAmount for one row, formatted. Args: { quantity, unitAmount } */
const bill_entry_line_total = (args) => {
    const qty = Number(args.quantity) || 0;
    const unit = Number(args.unitAmount) || 0;
    return formatAUD(qty * unit);
};
/**
 * Maps each TaxType code to its EffectiveRate (confirmed live: a plain
 * percentage number, e.g. 10 for 10% GST — NOT a 0–1 fraction). Built once
 * when list_tax_rates resolves, so per-line tax math never needs to re-scan
 * the full rates list. Args: { taxRates }
 */
const bill_entry_tax_rate_lookup = (args) => {
    const rates = Array.isArray(args.taxRates) ? args.taxRates : [];
    const map = {};
    for (const r of rates) {
        const taxType = String(r.TaxType ?? '');
        if (!taxType)
            continue;
        map[taxType] = Number(r.EffectiveRate) || 0;
    }
    return map;
};
/**
 * Tax amount for one row — quantity * unitAmount * (rate / 100) — using the
 * row's own selected taxType looked up in taxRateMap (from
 * bill_entry_tax_rate_lookup). Blank (not "$0.00") until a tax rate is
 * actually selected, so an untouched row doesn't read as "no tax" before
 * the user has made a choice.
 * Args: { quantity, unitAmount, taxType, taxRateMap }
 */
const bill_entry_line_tax = (args) => {
    const taxType = String(args.taxType ?? '').trim();
    if (!taxType)
        return '';
    const qty = Number(args.quantity) || 0;
    const unit = Number(args.unitAmount) || 0;
    const map = (args.taxRateMap ?? {});
    const rate = Number(map[taxType]) || 0;
    return formatAUD(qty * unit * (rate / 100));
};
/** Sum of quantity * unitAmount across all rows, formatted. Args: { lines } */
const bill_entry_grand_total = (args) => {
    const lines = Array.isArray(args.lines) ? args.lines : [];
    const total = lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unitAmount) || 0), 0);
    return formatAUD(total);
};
/**
 * True when the form is NOT ready to submit — supplier, date, and every
 * line item's description/quantity(>0)/unitAmount(>=0)/account/tax must
 * be filled. Args: { contactId, date, lines }
 */
const bill_entry_is_invalid = (args) => {
    const contactId = String(args.contactId ?? '').trim();
    const date = String(args.date ?? '').trim();
    const lines = Array.isArray(args.lines) ? args.lines : [];
    if (!contactId || !date || lines.length === 0)
        return true;
    for (const l of lines) {
        const desc = String(l.description ?? '').trim();
        const qty = Number(l.quantity);
        const unit = Number(l.unitAmount);
        const accountCode = String(l.accountCode ?? '').trim();
        const taxType = String(l.taxType ?? '').trim();
        if (!desc || !accountCode || !taxType)
            return true;
        if (!Number.isFinite(qty) || qty <= 0)
            return true;
        if (!Number.isFinite(unit) || unit < 0)
            return true;
    }
    return false;
};
/** Human-readable reason the form can't submit yet, mirroring bill_entry_is_invalid's checks in order. */
const bill_entry_validation_message = (args) => {
    const contactId = String(args.contactId ?? '').trim();
    const date = String(args.date ?? '').trim();
    const lines = Array.isArray(args.lines) ? args.lines : [];
    if (!contactId)
        return 'Select a supplier';
    if (!date)
        return 'Set the bill date';
    if (lines.length === 0)
        return 'Add at least one line item';
    for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        const n = i + 1;
        const desc = String(l.description ?? '').trim();
        const qty = Number(l.quantity);
        const unit = Number(l.unitAmount);
        const accountCode = String(l.accountCode ?? '').trim();
        const taxType = String(l.taxType ?? '').trim();
        if (!desc)
            return `Line ${n}: enter a description`;
        if (!Number.isFinite(qty) || qty <= 0)
            return `Line ${n}: quantity must be greater than 0`;
        if (!Number.isFinite(unit) || unit < 0)
            return `Line ${n}: unit price can't be negative`;
        if (!accountCode)
            return `Line ${n}: choose an account`;
        if (!taxType)
            return `Line ${n}: choose a tax rate`;
    }
    return '';
};
/**
 * Builds the raw Xero invoice body create_invoice expects. Status is set
 * explicitly to DRAFT (rather than relying on the tool's own default) so
 * this tile's intent — record a draft, not submit a live bill — is
 * unambiguous in the request itself.
 * Args: { contactId, date, dueDate, reference, lines }
 */
const bill_entry_build_payload = (args) => {
    const lines = Array.isArray(args.lines) ? args.lines : [];
    const date = String(args.date ?? '').trim();
    const dueDate = String(args.dueDate ?? '').trim();
    const reference = String(args.reference ?? '').trim();
    return {
        Type: 'ACCPAY',
        Status: 'DRAFT',
        Contact: { ContactID: String(args.contactId ?? '') },
        ...(date ? { Date: date } : {}),
        ...(dueDate ? { DueDate: dueDate } : {}),
        ...(reference ? { Reference: reference } : {}),
        LineItems: lines.map((l) => ({
            Description: String(l.description ?? ''),
            Quantity: Number(l.quantity) || 0,
            UnitAmount: Number(l.unitAmount) || 0,
            AccountCode: String(l.accountCode ?? ''),
            TaxType: String(l.taxType ?? ''),
        })),
    };
};
/**
 * Outstanding balances for the currently selected supplier, read straight
 * off list_contacts' own response — Xero already returns a `Balances`
 * block per contact (AccountsPayable/AccountsReceivable, each with
 * Outstanding/Overdue), so no extra API call is needed.
 * `AccountsPayable.Outstanding` = what we owe them; `AccountsReceivable
 * .Outstanding` = what they owe us (normally 0 for a pure supplier, but
 * shown in case the same contact is also set up as a customer).
 * Args: { contacts, contactId }
 */
const bill_entry_supplier_balances = (args) => {
    const contacts = Array.isArray(args.contacts) ? args.contacts : [];
    const contactId = String(args.contactId ?? '').trim();
    const empty = {
        hasSelection: false,
        weOwe: '',
        weOweOverdue: '',
        weOweTone: 'muted',
        theyOwe: '',
        theyOweOverdue: '',
        theyOweTone: 'muted',
    };
    if (!contactId)
        return empty;
    const contact = contacts.find((c) => String(c.ContactID ?? '') === contactId);
    if (!contact)
        return empty;
    const balances = (contact.Balances ?? {});
    const ap = (balances.AccountsPayable ?? {});
    const ar = (balances.AccountsReceivable ?? {});
    const apOutstanding = Number(ap.Outstanding) || 0;
    const apOverdue = Number(ap.Overdue) || 0;
    const arOutstanding = Number(ar.Outstanding) || 0;
    const arOverdue = Number(ar.Overdue) || 0;
    return {
        hasSelection: true,
        weOwe: formatAUD(apOutstanding),
        weOweOverdue: formatAUD(apOverdue),
        weOweIsOverdue: apOverdue > 0,
        // Destructive once any of it is overdue (we're late paying them) —
        // muted while current, same as this tile's amount-owed is otherwise
        // neutral data, not a status.
        weOweTone: apOverdue > 0 ? 'destructive' : apOutstanding > 0 ? 'default' : 'muted',
        theyOwe: formatAUD(arOutstanding),
        theyOweOverdue: formatAUD(arOverdue),
        theyOweIsOverdue: arOverdue > 0,
        // Warning rather than destructive — a customer paying us late isn't
        // this tile's own obligation the way an overdue bill to a supplier is.
        theyOweTone: arOverdue > 0 ? 'warning' : arOutstanding > 0 ? 'default' : 'muted',
    };
};
// ── analyze_autopay_exclusions ──────────────────────────────────────────
// Classifies every repeating ACCPAY bill template (`list_repeating_invoices`)
// by how automated it really is in Xero:
//  - AUTHORISED templates post without a human touching them each cycle —
//    the real "autopay" signal — so they're "Excluded from Check" (a
//    routine manual bill review doesn't need to re-examine them).
//  - DRAFT templates require a person to approve every generated bill —
//    "Needs Review".
// "New Exclusions" counts AUTHORISED templates whose Schedule.StartDate
// falls within the last ~40 days — the closest real proxy available, since
// Xero's RepeatingInvoice object carries no "date authorised"/created
// timestamp. `organisation` supplies the real ShortCode for the documented
// go.xero.com deep-link format (same mechanism as analyze_bill_duplicates),
// redirected to the general bills list (no single invoice to point at here).
// Returns a fresh `scannedAt` ISO timestamp every call — recomputes (and so
// updates) both on the initial mount fetch and every manual "Rescan Data"
// click, since both re-fire the same list_repeating_invoices watch chain.
// `filter` ('' | 'excluded' | 'needsReview' | 'new') narrows the returned
// `rows` to one stat tile's slice — set by clicking that tile, same
// click-to-filter pattern as the MYOB Duplicate Bills Queue tabs. The counts
// themselves always reflect the FULL set regardless of `filter`, so the tiles
// stay accurate while only the table below them narrows.
// Args: { repeatingInvoices?: RepeatingInvoice[], organisation?: unknown, newExclusionWindowDays?: number, filter?: string }
const analyze_autopay_exclusions = (args) => {
    const all = Array.isArray(args.repeatingInvoices) ? args.repeatingInvoices : [];
    const newWindowDays = Number(args.newExclusionWindowDays) > 0 ? Number(args.newExclusionWindowDays) : 40;
    const org = args.organisation ?? {};
    const orgs = Array.isArray(org.Organisations) ? org.Organisations : [];
    const shortCode = String(orgs[0]?.ShortCode ?? '');
    const parseDate = (raw) => {
        const m = String(raw ?? '').match(/\/Date\((-?\d+)(?:[+-]\d{4})?\)\//);
        return m ? Number(m[1]) : NaN;
    };
    const fmtDate = (ms) => Number.isFinite(ms) ? new Date(ms).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    const bills = all.filter((r) => r.Type === 'ACCPAY' && r.Status !== 'DELETED');
    const now = Date.now();
    const rows = bills
        .map((r) => {
        const contact = r.Contact;
        const startMs = parseDate(r.Schedule?.StartDate);
        const ageDays = Number.isFinite(startMs) ? (now - startMs) / 86_400_000 : NaN;
        const autopayEnabled = r.Status === 'AUTHORISED';
        const isNewExclusion = autopayEnabled && Number.isFinite(ageDays) && ageDays >= 0 && ageDays <= newWindowDays;
        return {
            contactId: String(contact?.ContactID ?? contact?.Name ?? Math.random()),
            vendor: String(contact?.Name ?? 'Unknown'),
            autopayEnabled,
            autopayStatusLabel: autopayEnabled ? 'Enabled' : 'Disabled',
            autopayStatusTone: autopayEnabled ? 'success' : 'muted',
            exclusionReason: autopayEnabled ? 'AutoPay Enabled' : 'Requires manual approval',
            added: fmtDate(startMs),
            startMs,
            isNewExclusion,
            status: autopayEnabled ? 'Excluded' : 'Needs Review',
            statusTone: autopayEnabled ? 'success' : 'warning',
        };
    })
        .sort((a, b) => (Number.isFinite(b.startMs) ? b.startMs : 0) - (Number.isFinite(a.startMs) ? a.startMs : 0));
    const withIsLast = (arr) => arr.map((r, i) => ({ ...r, isLast: i === arr.length - 1 }));
    const vendorCount = rows.length;
    const excludedCount = rows.filter((r) => r.autopayEnabled).length;
    const needsReviewCount = rows.filter((r) => !r.autopayEnabled).length;
    const newExclusionsCount = rows.filter((r) => r.isNewExclusion).length;
    const reviewUrl = shortCode
        ? `https://go.xero.com/organisationlogin/default.aspx?shortcode=${encodeURIComponent(shortCode)}&redirecturl=${encodeURIComponent('/AccountsPayable/Bills')}`
        : 'https://go.xero.com/';
    const filter = ['excluded', 'needsReview', 'new'].includes(String(args.filter)) ? String(args.filter) : '';
    const filteredRows = filter === 'excluded'
        ? rows.filter((r) => r.autopayEnabled)
        : filter === 'needsReview'
            ? rows.filter((r) => !r.autopayEnabled)
            : filter === 'new'
                ? rows.filter((r) => r.isNewExclusion)
                : rows;
    return {
        vendorCount,
        excludedCount,
        needsReviewCount,
        newExclusionsCount,
        reviewUrl,
        filter,
        filterLabel: filter === 'excluded' ? 'Excluded from Check' : filter === 'needsReview' ? 'Needs Review' : filter === 'new' ? 'New Exclusions' : '',
        filterIsAll: filter === '',
        filterIsExcluded: filter === 'excluded',
        filterIsNeedsReview: filter === 'needsReview',
        filterIsNew: filter === 'new',
        rows: withIsLast(filteredRows.map(({ startMs, isNewExclusion, ...r }) => r)),
        scannedAt: new Date().toISOString(),
    };
};
// ── contra_opportunities ────────────────────────────────────────────
// Finds contacts that have BOTH an open sales invoice (ACCREC) and an
// open bill (ACCPAY) — candidates for a contra/offset, since Xero has
// no native offset feature. For each such contact, pairs the LARGEST
// open invoice against the LARGEST open bill (by AmountDue) — a
// contact with several open documents on either side is a multi-pair
// scenario out of scope for this first pass; the suggested pair covers
// the common single-pair case.
//
// Blocks (but still lists, so the mismatch is visible rather than
// silently dropped) a pair whose invoice/bill currencies differ —
// netting across currencies isn't a straight min() of two amounts.
// A contact whose InvoiceNumber is blank (seen in real data) falls
// back to a short ID-based reference so the contra Reference is never
// empty.
//
// offsetAmount = min(invoice.AmountDue, bill.AmountDue), rounded to 2dp.
// Returns { rows, count, totalOffsettable } — rows sorted offsettable-
// first (largest offset first), blocked pairs last.
// Args: { contacts: Contact[], invoices: Invoice[] }
const contra_opportunities = (args) => {
    const contacts = Array.isArray(args.contacts) ? args.contacts : [];
    const invoices = Array.isArray(args.invoices) ? args.invoices : [];
    const byContact = new Map();
    for (const inv of invoices) {
        const contact = inv.Contact;
        const contactId = String(contact?.ContactID ?? '');
        if (!contactId)
            continue;
        const bucket = byContact.get(contactId) ?? { ar: [], ap: [] };
        if (inv.Type === 'ACCREC')
            bucket.ar.push(inv);
        else if (inv.Type === 'ACCPAY')
            bucket.ap.push(inv);
        byContact.set(contactId, bucket);
    }
    const largestBy = (docs) => docs.reduce((max, d) => (Number(d.AmountDue) > Number(max?.AmountDue ?? -1) ? d : max), docs[0]);
    const shortRef = (doc) => {
        const num = String(doc.InvoiceNumber ?? '').trim();
        if (num)
            return num;
        return `#${String(doc.InvoiceID ?? '').slice(0, 8)}`;
    };
    const rows = [];
    for (const contact of contacts) {
        const contactId = String(contact.ContactID ?? '');
        const bucket = byContact.get(contactId);
        if (!bucket || bucket.ar.length === 0 || bucket.ap.length === 0)
            continue;
        const invoice = largestBy(bucket.ar);
        const bill = largestBy(bucket.ap);
        const invoiceCurrency = String(invoice.CurrencyCode ?? '');
        const billCurrency = String(bill.CurrencyCode ?? '');
        const blocked = invoiceCurrency !== billCurrency;
        const offsetAmount = Math.round(Math.min(Number(invoice.AmountDue), Number(bill.AmountDue)) * 100) / 100;
        rows.push({
            contactId,
            contactName: String(contact.Name ?? 'Unknown'),
            invoiceId: String(invoice.InvoiceID ?? ''),
            invoiceNumber: shortRef(invoice),
            invoiceAmountDue: Number(invoice.AmountDue),
            billId: String(bill.InvoiceID ?? ''),
            billNumber: shortRef(bill),
            billAmountDue: Number(bill.AmountDue),
            offsetAmount,
            currency: invoiceCurrency,
            blocked,
            blockedReason: blocked ? `Currency mismatch (${invoiceCurrency} vs ${billCurrency})` : '',
            reference: `OFFSET-${shortRef(invoice)}-${shortRef(bill)}`,
        });
    }
    rows.sort((a, b) => {
        if (!!a.blocked !== !!b.blocked)
            return a.blocked ? 1 : -1;
        return b.offsetAmount - a.offsetAmount;
    });
    const totalOffsettable = rows
        .filter((r) => !r.blocked)
        .reduce((sum, r) => sum + r.offsetAmount, 0);
    return { rows, count: rows.length, totalOffsettable };
};
// ── find_clearing_account ────────────────────────────────────────────
// Picks the clearing/offset account from a list already filtered to
// EnablePaymentsToAccount==true (the dataProvider's own `where`) — a
// generic payable-enabled account (e.g. an Owner Drawings account) is
// NOT a clearing account and must not be silently offered as one, so
// this only matches on Code/Name actually hinting "clearing"/"offset"/
// "contra"/"suspense" rather than taking the first eligible account.
// Returns { found: false } when nothing matches, so the tile can show
// the manual Xero-UI setup instructions instead of guessing.
// Args: { accounts: Account[] }
const find_clearing_account = (args) => {
    const accounts = Array.isArray(args.accounts) ? args.accounts : [];
    const match = accounts.find((a) => /clearing|offset|contra|suspense/i.test(`${a.Code ?? ''} ${a.Name ?? ''}`));
    if (!match)
        return { found: false };
    return {
        found: true,
        accountId: String(match.AccountID ?? ''),
        code: String(match.Code ?? ''),
        name: String(match.Name ?? ''),
    };
};
// ── today_iso ─────────────────────────────────────────────────────────
// Today's date as YYYY-MM-DD, for Payment.Date on a same-day contra.
const today_iso = () => new Date().toISOString().slice(0, 10);
// ── contra_document_link ─────────────────────────────────────────────
// Deep link to a specific Xero invoice/bill's edit page — same
// `go.xero.com/organisationlogin/default.aspx?shortcode=...&
// redirecturl=/<Module>/Edit.aspx?InvoiceID=...` format already
// confirmed live elsewhere in this plugin (analyze_bill_duplicates,
// ready_to_pay_held) — a bare /AccountsPayable/... URL with no
// shortcode/org context 404s. Falls back to the generic Xero login
// page before get_organisation resolves or if ShortCode ever comes
// back empty.
// Args: { shortCode: string, invoiceId: string, type: 'ACCREC'|'ACCPAY' }
const contra_document_link = (args) => {
    const shortCode = String(args.shortCode ?? '').trim();
    const invoiceId = String(args.invoiceId ?? '').trim();
    if (!shortCode || !invoiceId)
        return 'https://go.xero.com/';
    const module = args.type === 'ACCPAY' ? 'AccountsPayable' : 'AccountsReceivable';
    const redirect = `/${module}/Edit.aspx?InvoiceID=${invoiceId}`;
    return `https://go.xero.com/organisationlogin/default.aspx?shortcode=${encodeURIComponent(shortCode)}&redirecturl=${encodeURIComponent(redirect)}`;
};
// ── contra_create_disabled ───────────────────────────────────────────
// Whether the "Create Contra" button should be disabled for a row —
// plain-boolean combinator, since generic props (unlike `visible`) don't
// evaluate $and/$or/native conditions themselves (confirmed from the
// json-render core source: that resolver only runs for the `visible`
// field). Disabled when the pair's currencies mismatch, or no eligible
// clearing account was found at all.
// Args: { blocked: boolean, clearingFound: boolean }
const contra_create_disabled = (args) => Boolean(args.blocked) || !args.clearingFound;
const elements = {
    slug: 'xero-accounting',
    functions: {
        analyze_bill_duplicates,
        analyze_autopay_exclusions,
        job_allocation_overview,
        time_ago,
        paginate,
        rate_variance_rows,
        ready_to_pay_held,
        format_date,
        status_tone,
        status_label,
        age_bucket,
        age_bucket_tone,
        age_buckets,
        invoices_in_bucket,
        bank_tx_icon,
        bank_tx_tone,
        bank_tx_label,
        reconciliation_breakdown,
        remittance_rows,
        remittance_breakdown,
        reimbursement_draft_rows,
        days_overdue,
        overdue_label,
        overdue_only,
        overdue_tone,
        awaiting_payment_breakdown,
        po_status_tone,
        quote_status_tone,
        this_month_range,
        prev_month_range,
        next_n_days,
        flatten_report_rows,
        report_find_row,
        analyze_duplicates,
        analyze_excluded_documents,
        bill_entry_add_line,
        bill_entry_line_total,
        bill_entry_grand_total,
        bill_entry_is_invalid,
        bill_entry_validation_message,
        bill_entry_build_payload,
        bill_entry_supplier_balances,
        bill_entry_tax_rate_lookup,
        bill_entry_line_tax,
        contra_opportunities,
        find_clearing_account,
        today_iso,
        contra_create_disabled,
        contra_document_link,
    },
};
export default elements;
