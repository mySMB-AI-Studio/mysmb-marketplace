/**
 * quickbooks-accounting — widget-elements module
 *
 * Helpers tailored to QuickBooks Online Accounting v3 payload shapes:
 *  - QBO uses ISO-8601 dates (YYYY-MM-DD), not the Microsoft `/Date()/`
 *    format Xero uses. So date parsing is simpler than the Xero helpers.
 *  - QBO reports nest under `{ Header, Columns, Rows: { Row: [...] } }`
 *    with `Section` rows containing nested `Rows.Row[]` and `Summary` rows,
 *    and `Data` rows containing `ColData: [{value}]` arrays. The shape is
 *    different from Xero's, so we have our own flattener.
 *  - QBO entity refs are `{ value, name }` objects under `<X>Ref`.
 */
// ── Date utilities ──────────────────────────────────────────────────────────
function toEpochMs(raw) {
    if (raw == null)
        return null;
    if (typeof raw === 'number')
        return raw;
    if (typeof raw !== 'string')
        return null;
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : null;
}
function isoDay(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
const format_date = (args) => {
    const raw = args.value;
    const format = args.format || 'short';
    if (raw == null || raw === '')
        return '';
    const ms = toEpochMs(raw);
    if (ms == null)
        return String(raw);
    const d = new Date(ms);
    if (format === 'iso')
        return d.toISOString().slice(0, 10);
    if (format === 'long') {
        return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    }
    if (format === 'medium') {
        return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    }
    return d.toLocaleDateString(undefined, { year: '2-digit', month: 'short', day: 'numeric' });
};
const today_minus_days = (args) => {
    const n = Number(args.days ?? 0);
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (Number.isFinite(n) ? n : 0));
    return isoDay(d);
};
const today_plus_days = (args) => {
    const n = Number(args.days ?? 0);
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + (Number.isFinite(n) ? n : 0));
    return isoDay(d);
};
const period_bounds = (args) => {
    const period = String(args.period ?? 'last');
    const now = new Date();
    let from;
    let to;
    if (period === 'this') {
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }
    else if (period === 'custom') {
        const startStr = args.start ? String(args.start) : isoDay(new Date(now.getFullYear(), now.getMonth(), 1));
        const endStr = args.end ? String(args.end) : isoDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
        return { start: startStr, end: endStr, label: `${startStr} → ${endStr}` };
    }
    else {
        // last month, default
        from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        to = new Date(now.getFullYear(), now.getMonth(), 0);
    }
    const label = from.toLocaleDateString(undefined, { year: 'numeric', month: 'long' });
    return { start: isoDay(from), end: isoDay(to), label };
};
// QBO `date_macro` strings the report endpoint accepts. We translate UI period
// + comparison-basis selections into the right macro for the API.
const period_to_date_macro = (args) => {
    const period = String(args.period ?? 'MTD');
    const basis = String(args.basis ?? 'current');
    const compare = String(args.compare ?? 'PriorYear');
    if (basis === 'current') {
        if (period === 'MTD')
            return 'This Month-to-date';
        if (period === 'QTD')
            return 'This Quarter-to-date';
        if (period === 'YTD')
            return 'This Fiscal Year-to-date';
        if (period === 'LastMonth')
            return 'Last Month';
        if (period === 'LastQuarter')
            return 'Last Fiscal Quarter';
        return 'This Month-to-date';
    }
    // prior
    if (compare === 'PriorYear') {
        if (period === 'MTD')
            return 'Last Year This Month';
        if (period === 'QTD')
            return 'Last Year This Quarter';
        if (period === 'YTD')
            return 'Last Fiscal Year-to-date';
        if (period === 'LastMonth')
            return 'Last Year Last Month';
        if (period === 'LastQuarter')
            return 'Last Year Last Quarter';
        return 'Last Year This Month';
    }
    // PriorPeriod
    if (period === 'MTD')
        return 'Last Month-to-date';
    if (period === 'QTD')
        return 'Last Fiscal Quarter-to-date';
    if (period === 'YTD')
        return 'Last Fiscal Year-to-date';
    if (period === 'LastMonth')
        return 'Last Month';
    if (period === 'LastQuarter')
        return 'Last Fiscal Quarter';
    return 'Last Month-to-date';
};
// ── Overdue / aging helpers ────────────────────────────────────────────────
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
const overdue_tone = (args) => {
    const n = Number(days_overdue({ value: args.value }));
    if (!Number.isFinite(n) || n <= 0)
        return 'muted';
    if (n <= 30)
        return 'info';
    if (n <= 60)
        return 'warning';
    return 'destructive';
};
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
// ── age_buckets ──────────────────────────────────────────────────────
// Reduce an Invoice[] into a fixed-order array of aged buckets:
//   [{ key, count, total, tone }, ...]
// Mirrors xero-accounting's `age_buckets` so the QBO Aged Receivables
// widget can render the same clickable-row-with-breakdown shape. QBO
// invoices carry the outstanding balance in `Balance` (Xero uses
// `AmountDue`).
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
            const amt = Number(inv?.Balance);
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
// Filter Invoice[] down to just those whose age_bucket matches the
// supplied bucket key. Used by the breakdown panel on click.
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
// ── filter_payments_unapplied ────────────────────────────────────────
// Return only payments with an UnappliedAmt > 0. The QBO query language
// rejects WHERE filters on `UnappliedAmt` (it isn't queryable), so the
// close-checklist fetches all recent payments and narrows here.
// Args: { value: Payment[] }
const filter_payments_unapplied = (args) => {
    const arr = args.value;
    if (!Array.isArray(arr))
        return [];
    return arr.filter((p) => {
        const n = Number(p?.UnappliedAmt);
        return Number.isFinite(n) && n > 0;
    });
};
// ── filter_overdue_min_days ──────────────────────────────────────────
// Filter rows (Bill | Invoice) where DueDate is overdue by at least N
// days. Used by widgets that fetch with a simple `Balance > '0'` where
// clause (no date arithmetic in the QBO query) and then narrow down
// client-side. Action params don't currently resolve `$computed`, so
// any time math has to happen here.
// Args: { value: Array<{DueDate?: string}>, minDays: number }
const filter_overdue_min_days = (args) => {
    const arr = args.value;
    const min = Number(args.minDays ?? 0);
    if (!Array.isArray(arr))
        return [];
    return arr.filter((row) => {
        const due = row?.DueDate;
        const n = Number(days_overdue({ value: due }));
        return Number.isFinite(n) && n >= min;
    });
};
// ── overdue_only ─────────────────────────────────────────────────────
// Return only the invoices whose DueDate is in the past (daysOverdue > 0).
// Mirrors the xero-accounting `overdue_only` helper so chase/collections
// widgets can pre-filter the AUTHORISED / open list to just the rows
// that need attention.
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
function readColData(r) {
    const cd = r.ColData;
    if (Array.isArray(cd))
        return cd;
    return null;
}
const flatten_report_rows = (args) => {
    const src = args.value;
    if (!src || typeof src !== 'object')
        return [];
    let rootRows = src.Rows?.Row ??
        src.Row ??
        src;
    if (!Array.isArray(rootRows))
        return [];
    const out = [];
    const walk = (list, depth, sectionTitle) => {
        for (const r of list) {
            if (!r || typeof r !== 'object')
                continue;
            const rowType = String(r.type ?? r.RowType ?? 'Data');
            const group = String(r.group ?? '');
            if (rowType === 'Section') {
                const header = r.Header;
                const newSectionTitle = header?.ColData?.[0]?.value != null
                    ? String(header.ColData[0].value)
                    : sectionTitle;
                const nested = r.Rows?.Row;
                if (Array.isArray(nested)) {
                    walk(nested, depth + 1, newSectionTitle);
                }
                const summary = r.Summary;
                if (summary) {
                    const cd = readColData(summary);
                    if (cd) {
                        const flat = {
                            title: cd[0]?.value != null ? String(cd[0].value) : `Total ${newSectionTitle}`,
                            rowType: 'Summary',
                            group,
                            depth,
                            sectionTitle: newSectionTitle,
                            id: '',
                        };
                        cd.forEach((cell, idx) => { flat[`c${idx}`] = cell?.value ?? ''; });
                        out.push(flat);
                    }
                }
                continue;
            }
            const cd = readColData(r);
            if (!cd)
                continue;
            const flat = {
                title: cd[0]?.value != null ? String(cd[0].value) : '',
                rowType,
                group,
                depth,
                sectionTitle,
                id: cd[0]?.id != null ? String(cd[0].id) : '',
            };
            cd.forEach((cell, idx) => { flat[`c${idx}`] = cell?.value ?? ''; });
            out.push(flat);
        }
    };
    walk(rootRows, 0, '');
    return out;
};
const report_find_row = (args) => {
    const arr = args.value;
    if (!Array.isArray(arr))
        return 0;
    const want = String(args.title ?? '').toLowerCase().trim();
    const cellIdx = typeof args.cell === 'number' ? args.cell : 1;
    const exact = args.exact ?? false;
    const row = arr.find((r) => {
        const t = String(r?.title ?? '').toLowerCase().trim();
        return exact ? t === want : t === want || t.includes(want);
    });
    if (!row)
        return 0;
    const raw = row[`c${cellIdx}`];
    const n = Number(raw);
    return Number.isFinite(n) ? n : 0;
};
const report_currency = (args) => {
    const src = args.value;
    return String(src?.Header?.Currency ?? 'USD');
};
// ── Aging-specific helpers (Widget 1) ──────────────────────────────────────
// The QBO Aged Receivables report puts the bucket columns under a single
// summary row "TOTAL". This pulls the numeric cell at the requested index.
const aging_bucket_total = (args) => {
    const flat = args.rows;
    if (!Array.isArray(flat))
        return 0;
    const cellIdx = Number(args.cell ?? 1);
    // Look for any row whose title starts with "TOTAL" (case-insensitive).
    const total = flat.find((r) => {
        const t = String(r?.title ?? '').toLowerCase();
        return t === 'total' || t.startsWith('total');
    });
    if (!total)
        return 0;
    const v = total[`c${cellIdx}`];
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};
// DSO = (AR balance / sales over period) × periodDays. Returns "—" when
// we can't compute (zero sales). String return is intentional — the widget
// renders this as-is.
const dso = (args) => {
    const ar = Number(args.arBalance ?? 0);
    const sales = Number(args.sales ?? 0);
    const periodDays = Number(args.periodDays ?? 90);
    if (!Number.isFinite(ar) || !Number.isFinite(sales) || sales <= 0)
        return '—';
    return Math.round((ar / sales) * periodDays);
};
function startOfWeek(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    const day = x.getDay(); // 0 = Sunday
    x.setDate(x.getDate() - day);
    return x;
}
function diffWeeks(target, ref) {
    const day = 24 * 60 * 60 * 1000;
    const t = startOfWeek(target).getTime();
    const r = startOfWeek(ref).getTime();
    return Math.floor((t - r) / (7 * day));
}
const weekly_cash_projection = (args) => {
    const openingCash = Number(args.openingCash ?? 0);
    const invoices = Array.isArray(args.invoices) ? args.invoices : [];
    const bills = Array.isArray(args.bills) ? args.bills : [];
    const weeks = Number(args.weeks ?? 13);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const week0 = startOfWeek(today);
    const day = 24 * 60 * 60 * 1000;
    const buckets = Array.from({ length: weeks }, (_, i) => {
        const start = new Date(week0.getTime() + i * 7 * day);
        const end = new Date(start.getTime() + 6 * day);
        return {
            weekIndex: i + 1,
            weekStart: isoDay(start),
            weekEnd: isoDay(end),
            label: `Wk ${i + 1}`,
            inflow: 0,
            outflow: 0,
            net: 0,
            endingCash: 0,
            tone: 'success',
        };
    });
    for (const inv of invoices) {
        const dueRaw = inv.DueDate ?? inv.dueDate;
        if (!dueRaw)
            continue;
        const due = new Date(String(dueRaw));
        const idx = diffWeeks(due, week0);
        const bal = Number(inv.Balance ?? inv.balance ?? 0);
        if (!Number.isFinite(bal) || bal === 0)
            continue;
        if (idx < 0)
            buckets[0].inflow += bal; // already past due → assume collected wk 1
        else if (idx < weeks)
            buckets[idx].inflow += bal;
    }
    for (const bill of bills) {
        const dueRaw = bill.DueDate ?? bill.dueDate;
        if (!dueRaw)
            continue;
        const due = new Date(String(dueRaw));
        const idx = diffWeeks(due, week0);
        const bal = Number(bill.Balance ?? bill.balance ?? 0);
        if (!Number.isFinite(bal) || bal === 0)
            continue;
        if (idx < 0)
            buckets[0].outflow += bal; // already past due → assume paid wk 1
        else if (idx < weeks)
            buckets[idx].outflow += bal;
    }
    let running = openingCash;
    const floor = Math.abs(openingCash) * 0.05 || 5000;
    for (const b of buckets) {
        b.net = b.inflow - b.outflow;
        running += b.net;
        b.endingCash = running;
        if (b.endingCash <= -floor)
            b.tone = 'destructive';
        else if (b.endingCash <= 0)
            b.tone = 'warning';
        else
            b.tone = 'success';
    }
    return buckets;
};
const runway_weeks = (args) => {
    const buckets = Array.isArray(args.buckets) ? args.buckets : [];
    const currentCash = Number(args.currentCash ?? 0);
    if (buckets.length === 0)
        return '—';
    const totalNet = buckets.reduce((acc, b) => acc + (b?.net ?? 0), 0);
    const avgWeekly = totalNet / buckets.length;
    if (avgWeekly >= 0)
        return '∞';
    if (currentCash <= 0)
        return 0;
    return Math.max(0, Math.round(currentCash / Math.abs(avgWeekly)));
};
const first_negative_week = (args) => {
    const buckets = Array.isArray(args.buckets) ? args.buckets : [];
    const idx = buckets.findIndex((b) => (b?.endingCash ?? 0) < 0);
    if (idx === -1)
        return null;
    return buckets[idx].label;
};
// QBO list_account returns AccountType strings like "Bank", "Credit Card".
// Sum CurrentBalance across all rows whose AccountType is "Bank" (cash on hand).
const sum_bank_balances = (args) => {
    const accounts = Array.isArray(args.value) ? args.value : [];
    return accounts
        .filter((a) => String(a?.AccountType ?? '') === 'Bank' && (a?.Active ?? true))
        .reduce((acc, a) => acc + (Number(a?.CurrentBalance ?? 0) || 0), 0);
};
const sum_creditcard_balances = (args) => {
    const accounts = Array.isArray(args.value) ? args.value : [];
    return accounts
        .filter((a) => String(a?.AccountType ?? '') === 'Credit Card' && (a?.Active ?? true))
        .reduce((acc, a) => acc + (Number(a?.CurrentBalance ?? 0) || 0), 0);
};
// Sum a numeric field across an array, optional `where` filter on another field.
const sum_field = (args) => {
    const arr = Array.isArray(args.value) ? args.value : [];
    const field = String(args.field ?? 'Balance');
    const whereField = args.whereField ? String(args.whereField) : null;
    const eq = args.eq != null ? String(args.eq) : null;
    return arr.reduce((acc, r) => {
        if (whereField && eq != null && String(r?.[whereField] ?? '') !== eq)
            return acc;
        const n = Number(r?.[field] ?? 0);
        return acc + (Number.isFinite(n) ? n : 0);
    }, 0);
};
// ── Close-checklist helpers (Widget 3) ─────────────────────────────────────
const close_status_tone = (args) => {
    const pass = Boolean(args.pass);
    if (pass)
        return 'success';
    const severity = String(args.severity ?? 'warning');
    if (severity === 'destructive')
        return 'destructive';
    return 'warning';
};
const close_status_icon = (args) => {
    const pass = Boolean(args.pass);
    if (pass)
        return 'CircleCheck';
    return 'AlertTriangle';
};
const close_status_label = (args) => {
    const count = Number(args.count ?? 0);
    const value = Number(args.value ?? 0);
    if (!count && !value)
        return 'OK';
    if (count && value)
        return `${count} · ${value.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}`;
    if (count)
        return `${count}`;
    return value.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
};
// Look up the QBO "Undeposited Funds" account ID from a list_account response.
const find_undeposited_funds_id = (args) => {
    const accounts = Array.isArray(args.value) ? args.value : [];
    const hit = accounts.find((a) => {
        const sub = String(a?.AccountSubType ?? '');
        const name = String(a?.Name ?? '').toLowerCase();
        return sub === 'UndepositedFunds' || name === 'undeposited funds';
    });
    return hit ? String(hit?.Id ?? '') : '';
};
const find_undeposited_funds_balance = (args) => {
    const accounts = Array.isArray(args.value) ? args.value : [];
    const hit = accounts.find((a) => {
        const sub = String(a?.AccountSubType ?? '');
        const name = String(a?.Name ?? '').toLowerCase();
        return sub === 'UndepositedFunds' || name === 'undeposited funds';
    });
    return hit ? Number(hit?.CurrentBalance ?? 0) : 0;
};
// ── P&L Variance helpers (Widget 4) ────────────────────────────────────────
const variance = (args) => {
    const current = Number(args.current ?? 0);
    const prior = Number(args.prior ?? 0);
    const invert = Boolean(args.invert);
    const delta = current - prior;
    const pct = prior === 0 ? null : (delta / Math.abs(prior)) * 100;
    // For expenses, an increase is bad — invert tone semantics.
    const goingUp = delta > 0;
    const goingDown = delta < 0;
    let tone = 'muted';
    if (goingUp)
        tone = invert ? 'destructive' : 'success';
    else if (goingDown)
        tone = invert ? 'success' : 'destructive';
    const arrow = goingUp ? 'ArrowUpRight' : goingDown ? 'ArrowDownRight' : 'Minus';
    return {
        delta,
        pct: pct == null ? null : Math.round(pct * 10) / 10,
        pctLabel: pct == null ? '—' : `${pct >= 0 ? '+' : ''}${(Math.round(pct * 10) / 10).toFixed(1)}%`,
        tone,
        arrow,
    };
};
const pnl_extract = (args) => {
    // Convenience: flatten + find in one step. Use when widget wants a single
    // line item from a report response without staging intermediate state.
    const report = args.value;
    const lineName = String(args.line ?? '');
    const cell = Number(args.cell ?? 1);
    const flat = flatten_report_rows({ value: report });
    return report_find_row({ value: flat, title: lineName, cell });
};
// Count the number of numeric data columns a flattened-monthly-pnl has.
// QBO returns: c0 = title, c1..c12 = months, c13 = YTD total.
// We sniff by walking c1..c20 on the first row.
const pnl_column_count = (args) => {
    const rows = Array.isArray(args.value) ? args.value : [];
    if (rows.length === 0)
        return 0;
    // Use the longest row (Summary rows have more cells than empty Data rows).
    let max = 0;
    for (const r of rows) {
        for (let i = 1; i <= 30; i++) {
            if (r[`c${i}`] !== undefined && r[`c${i}`] !== null && r[`c${i}`] !== '') {
                if (i > max)
                    max = i;
            }
        }
    }
    return max;
};
// For a monthly P&L the columns are: c0=title, c1..c12=months, c13=YTD total.
// "Latest month" = the rightmost MONTH column = pnl_column_count - 1.
// (The rightmost cell is YTD total — not what we want for "this month".)
const pnl_latest_month_index = (args) => {
    const rows = Array.isArray(args.value) ? args.value : [];
    const n = Number(pnl_column_count({ value: rows }));
    return Math.max(1, n - 1);
};
const pnl_prior_month_index = (args) => {
    const rows = Array.isArray(args.value) ? args.value : [];
    const n = Number(pnl_column_count({ value: rows }));
    return Math.max(1, n - 2);
};
// MoM variance for one line item — uses pnl_latest_month_index and
// pnl_prior_month_index so we don't mistakenly pick up the YTD column.
const pnl_mom_variance = (args) => {
    const rows = Array.isArray(args.rows) ? args.rows : [];
    const line = String(args.line ?? '');
    const invert = Boolean(args.invert);
    const latestIdx = Number(pnl_latest_month_index({ value: rows }));
    const priorIdx = Number(pnl_prior_month_index({ value: rows }));
    if (latestIdx === priorIdx)
        return variance({ current: 0, prior: 0, invert });
    const current = Number(report_find_row({ value: rows, title: line, cell: latestIdx }));
    const prior = Number(report_find_row({ value: rows, title: line, cell: priorIdx }));
    return variance({ current, prior, invert });
};
const pnl_line_monthly_series = (args) => {
    const rows = Array.isArray(args.rows) ? args.rows : [];
    const columnHeaders = Array.isArray(args.columnHeaders)
        ? args.columnHeaders
        : [];
    const line = String(args.line ?? '');
    const n = Number(pnl_column_count({ value: rows }));
    const out = [];
    // Drop the last column (YTD total) — show only the months.
    for (let i = 1; i < n; i++) {
        out.push({
            month: columnHeaders[i] ?? `M${i}`,
            value: Number(report_find_row({ value: rows, title: line, cell: i })) || 0,
        });
    }
    return out;
};
// Extract column headers (month names) from the raw report response.
const pnl_column_headers = (args) => {
    const r = args.value;
    const cols = r?.Columns?.Column;
    if (!Array.isArray(cols))
        return [];
    return cols.map((c) => String(c?.ColTitle ?? ''));
};
// Top movers between current and prior flattened rows. Matches on `title`.
const top_movers = (args) => {
    const current = Array.isArray(args.current) ? args.current : [];
    const prior = Array.isArray(args.prior) ? args.prior : [];
    const n = Number(args.n ?? 5);
    const priorMap = new Map();
    for (const r of prior) {
        if (r?.rowType !== 'Data')
            continue;
        priorMap.set(String(r?.title ?? ''), Number(r?.c1 ?? 0) || 0);
    }
    const movers = [];
    for (const r of current) {
        if (r?.rowType !== 'Data')
            continue;
        const title = String(r?.title ?? '');
        if (!title)
            continue;
        const curVal = Number(r?.c1 ?? 0) || 0;
        const prVal = priorMap.get(title) ?? 0;
        const delta = curVal - prVal;
        if (Math.abs(delta) < 0.01)
            continue;
        const pct = prVal === 0 ? null : Math.round((delta / Math.abs(prVal)) * 1000) / 10;
        movers.push({
            title,
            current: curVal,
            prior: prVal,
            delta,
            pct,
            tone: delta > 0 ? 'success' : 'destructive',
        });
    }
    movers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    return movers.slice(0, n);
};
// ── Customer Watch helpers (Widget 5) ──────────────────────────────────────
const pct_of_total = (args) => {
    const value = Number(args.value ?? 0);
    const total = Number(args.total ?? 0);
    if (!Number.isFinite(value) || !Number.isFinite(total) || total === 0)
        return 0;
    return Math.round((value / total) * 1000) / 10;
};
// Concentration percentage of top N rows out of total. Expects flattened
// customer-sales rows with a numeric `c1` cell (revenue).
const concentration_top_n = (args) => {
    const rows = Array.isArray(args.value) ? args.value : [];
    const n = Number(args.n ?? 5);
    const dataRows = rows.filter((r) => r?.rowType === 'Data');
    const numericRows = dataRows.map((r) => Number(r?.c1 ?? 0) || 0).sort((a, b) => b - a);
    const total = numericRows.reduce((a, b) => a + b, 0);
    if (total === 0)
        return 0;
    const top = numericRows.slice(0, n).reduce((a, b) => a + b, 0);
    return Math.round((top / total) * 1000) / 10;
};
// Top-N customer rows annotated with their pct-of-total. Used for the bar list.
const top_customers_with_pct = (args) => {
    const rows = Array.isArray(args.value) ? args.value : [];
    const n = Number(args.n ?? 5);
    const dataRows = rows
        .filter((r) => r?.rowType === 'Data')
        .map((r) => ({
        id: String(r?.id ?? ''),
        title: String(r?.title ?? ''),
        revenue: Number(r?.c1 ?? 0) || 0,
    }))
        .sort((a, b) => b.revenue - a.revenue);
    const total = dataRows.reduce((acc, r) => acc + r.revenue, 0);
    const topMax = dataRows[0]?.revenue ?? 0;
    return dataRows.slice(0, n).map((r, idx) => ({
        rank: idx + 1,
        id: r.id,
        title: r.title,
        revenue: r.revenue,
        pct: total === 0 ? 0 : Math.round((r.revenue / total) * 1000) / 10,
        barPct: topMax === 0 ? 0 : Math.round((r.revenue / topMax) * 1000) / 10,
    }));
};
const customer_risk_flags = (args) => {
    const customers = Array.isArray(args.customers) ? args.customers : [];
    const invoices = Array.isArray(args.invoices) ? args.invoices : [];
    const payments = Array.isArray(args.payments) ? args.payments : [];
    const salesTopN = Array.isArray(args.salesTopN) ? args.salesTopN : [];
    // Build a quick map: customerId → { openBalance, oldestOverdueDays, last90Sales }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const day = 24 * 60 * 60 * 1000;
    const invByCustomer = new Map();
    for (const inv of invoices) {
        const cust = inv?.CustomerRef;
        const cid = cust?.value != null ? String(cust.value) : '';
        if (!cid)
            continue;
        const list = invByCustomer.get(cid) ?? [];
        list.push(inv);
        invByCustomer.set(cid, list);
    }
    const payByCustomer = new Map();
    for (const p of payments) {
        const cust = p?.CustomerRef;
        const cid = cust?.value != null ? String(cust.value) : '';
        if (!cid)
            continue;
        const list = payByCustomer.get(cid) ?? [];
        list.push(p);
        payByCustomer.set(cid, list);
    }
    // Pre-compute concentration share for each customer in salesTopN.
    const totalRevenue = salesTopN.reduce((acc, r) => acc + (Number(r?.c1 ?? 0) || 0), 0);
    const revShare = new Map();
    for (const r of salesTopN) {
        const id = String(r?.id ?? '');
        if (!id)
            continue;
        const rev = Number(r?.c1 ?? 0) || 0;
        if (totalRevenue > 0)
            revShare.set(id, (rev / totalRevenue) * 100);
    }
    const flagged = [];
    for (const c of customers) {
        const id = c?.Id != null ? String(c.Id) : '';
        if (!id)
            continue;
        const name = String(c?.DisplayName ?? c?.CompanyName ?? '');
        const openBalance = Number(c?.Balance ?? 0) || 0;
        if ((c?.Active ?? true) === false)
            continue;
        const myInvoices = invByCustomer.get(id) ?? [];
        const myPayments = payByCustomer.get(id) ?? [];
        let severity = null;
        let flagLabel = '';
        // 1. Concentration + 60+ late invoice (orange)
        const share = revShare.get(id) ?? 0;
        const hasSixtyPlusLate = myInvoices.some((inv) => {
            const due = inv?.DueDate ? toEpochMs(inv.DueDate) : null;
            const bal = Number(inv?.Balance ?? 0) || 0;
            return bal > 0 && due != null && (today.getTime() - due) / day > 60;
        });
        if (share >= 10 && hasSixtyPlusLate) {
            severity = 'orange';
            flagLabel = `Concentration ${share.toFixed(0)}%, 60+ late invoice open`;
        }
        // 2. Balance ballooning (red) — simple proxy: open balance > 25% of sales share
        // (full impl needs historical balance snapshots — out of scope for v1).
        if (!severity && share > 0 && openBalance > 0) {
            const totalSales = (Number(salesTopN.find((r) => String(r?.id) === id)?.c1 ?? 0) || 0);
            if (totalSales > 0 && openBalance > totalSales * 0.5) {
                severity = 'red';
                flagLabel = `Open balance ${(openBalance / totalSales * 100).toFixed(0)}% of revenue`;
            }
        }
        // 3. Going quiet (yellow) — no invoice in last 90 days, had revenue this year.
        if (!severity && (Number(c?.Balance ?? 0) > 0 || (revShare.get(id) ?? 0) > 0)) {
            const latestInv = myInvoices
                .map((i) => toEpochMs(i?.TxnDate))
                .filter((ms) => ms != null)
                .sort((a, b) => b - a)[0];
            if (latestInv != null && (today.getTime() - latestInv) / day > 90) {
                severity = 'yellow';
                flagLabel = `No invoice in ${Math.round((today.getTime() - latestInv) / day)} days`;
            }
        }
        if (!severity)
            continue;
        flagged.push({ id, name, severity, flagLabel, openBalance });
    }
    const order = { red: 0, orange: 1, yellow: 2 };
    flagged.sort((a, b) => order[a.severity] - order[b.severity] || b.openBalance - a.openBalance);
    return flagged;
};
const risk_severity_tone = (args) => {
    const s = String(args.value ?? '').toLowerCase();
    if (s === 'red')
        return 'destructive';
    if (s === 'orange')
        return 'warning';
    if (s === 'yellow')
        return 'info';
    return 'muted';
};
const risk_severity_icon = (args) => {
    const s = String(args.value ?? '').toLowerCase();
    if (s === 'red')
        return 'AlertOctagon';
    if (s === 'orange')
        return 'AlertTriangle';
    if (s === 'yellow')
        return 'AlertCircle';
    return 'Circle';
};
// ── Misc helpers used across widgets ───────────────────────────────────────
// Truthy → "primary", falsy → "ghost". Drives toggle-button visual state.
const tab_variant = (args) => {
    const active = args.active === args.want;
    return active ? 'primary' : 'ghost';
};
const tab_tone = (args) => {
    const active = args.active === args.want;
    return active ? 'accent' : 'muted';
};
const eq = (args) => args.a === args.b;
const neq = (args) => args.a !== args.b;
const not_zero = (args) => {
    const n = Number(args.value ?? 0);
    return Number.isFinite(n) && n !== 0;
};
const is_zero = (args) => {
    const n = Number(args.value ?? 0);
    return !Number.isFinite(n) || n === 0;
};
// Count an array and report whether the count is zero — used by ChecklistItem
// `pass` flags. Returns boolean.
const count_is_zero = (args) => {
    const v = args.value;
    if (!Array.isArray(v))
        return true;
    return v.length === 0;
};
// Truthy iff value is a non-empty string. Used for "BookCloseDate" check.
const is_truthy_string = (args) => {
    const v = args.value;
    if (v == null)
        return false;
    return typeof v === 'string' && v.length > 0;
};
// Build a QBO where clause for "due before today minus N days". QBO query
// language wants `DueDate < 'YYYY-MM-DD'`. We pre-render the string here so
// action params don't need string concatenation primitives.
const where_due_before_today_minus = (args) => {
    const days = Number(args.days ?? 60);
    const balanceField = String(args.balanceField ?? 'Balance');
    const balanceOp = String(args.balanceOp ?? '> 0');
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (Number.isFinite(days) ? days : 60));
    const iso = isoDay(d);
    return `${balanceField} ${balanceOp} AND DueDate < '${iso}'`;
};
// ── Composite components ───────────────────────────────────────────────────
// `ChecklistItem` — one hygiene-check row in the close checklist. Props:
//   { label: string, count: number, value: number, pass: boolean,
//     severity: 'warning'|'destructive', onClickPath: string,
//     selectionValue: string }
const ChecklistItem = {
    kind: 'composite',
    props: ['label', 'count', 'value', 'pass', 'severity', 'onClickPath', 'selectionValue'],
    spec: {
        root: 'row',
        elements: {
            row: {
                type: 'Row',
                props: { gap: 'sm', align: 'center', hover: true, clickable: true },
                children: ['statusIcon', 'labelStack', 'amount', 'chevron'],
                on: {
                    click: {
                        action: 'setState',
                        params: { statePath: { $prop: 'onClickPath' }, value: { $prop: 'selectionValue' } },
                    },
                },
            },
            statusIcon: {
                type: 'Icon',
                props: {
                    name: {
                        $computed: 'quickbooks-accounting_close_status_icon',
                        args: { pass: { $prop: 'pass' } },
                    },
                    tone: {
                        $computed: 'quickbooks-accounting_close_status_tone',
                        args: { pass: { $prop: 'pass' }, severity: { $prop: 'severity' } },
                    },
                    size: 'sm',
                },
            },
            labelStack: {
                type: 'Stack',
                props: { gap: 'xs', grow: true },
                children: ['label', 'sub'],
            },
            label: {
                type: 'Text',
                props: { text: { $prop: 'label' }, size: 'sm', weight: 'medium' },
            },
            sub: {
                type: 'Caption',
                props: {
                    text: {
                        $computed: 'quickbooks-accounting_close_status_label',
                        args: { count: { $prop: 'count' }, value: { $prop: 'value' } },
                    },
                },
            },
            amount: {
                type: 'Text',
                props: {
                    text: {
                        $computed: 'format_currency',
                        args: { value: { $prop: 'value' }, currency: 'USD' },
                    },
                    size: 'sm',
                    weight: 'semibold',
                    tone: {
                        $computed: 'quickbooks-accounting_close_status_tone',
                        args: { pass: { $prop: 'pass' }, severity: { $prop: 'severity' } },
                    },
                },
            },
            chevron: {
                type: 'Icon',
                props: { name: 'ChevronRight', tone: 'muted', size: 'xs' },
            },
        },
    },
};
const elements = {
    slug: 'quickbooks-accounting',
    functions: {
        format_date,
        today_minus_days,
        today_plus_days,
        period_bounds,
        period_to_date_macro,
        days_overdue,
        overdue_label,
        overdue_only,
        overdue_tone,
        age_bucket,
        age_buckets,
        invoices_in_bucket,
        filter_payments_unapplied,
        filter_overdue_min_days,
        flatten_report_rows,
        report_find_row,
        report_currency,
        aging_bucket_total,
        dso,
        weekly_cash_projection,
        runway_weeks,
        first_negative_week,
        sum_bank_balances,
        sum_creditcard_balances,
        sum_field,
        close_status_tone,
        close_status_icon,
        close_status_label,
        find_undeposited_funds_id,
        find_undeposited_funds_balance,
        variance,
        pnl_extract,
        pnl_column_count,
        pnl_latest_month_index,
        pnl_prior_month_index,
        pnl_mom_variance,
        pnl_line_monthly_series,
        pnl_column_headers,
        top_movers,
        pct_of_total,
        concentration_top_n,
        top_customers_with_pct,
        customer_risk_flags,
        risk_severity_tone,
        risk_severity_icon,
        tab_variant,
        tab_tone,
        eq,
        neq,
        not_zero,
        is_zero,
        count_is_zero,
        is_truthy_string,
        where_due_before_today_minus,
    },
    components: {
        ChecklistItem,
    },
};
export default elements;
