/**
 * myob-accounting — widget-elements module
 * ──────────────────────────────────────────────────────────────────
 * Connector-specific `$computed` helpers contributed to the host's
 * widgets-system at runtime. The host prepends the slug `myob-accounting_`
 * to every name in `functions`, so e.g. the spec-side reference is
 * `myob-accounting_format_currency`.
 */
// ── format_currency ──────────────────────────────────────────────────
// Format a number as AUD using en-AU locale so the symbol renders as
// "$" rather than "A$" (which Intl produces in non-AU locales).
// Args: { value: number | string }
const format_currency = (args) => {
    const n = Number(args.value);
    if (!Number.isFinite(n))
        return '';
    const fmt = new Intl.NumberFormat('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return 'A$' + fmt.format(n);
};
// ── overdue_buckets ──────────────────────────────────────────────────
// Groups open invoices into overdue age buckets based on DueDate.
// Only includes invoices where DueDate < today (genuinely overdue).
// Returns { buckets: [{ key, label, count, total, tone }], total, count }
// Buckets are ordered worst-first: 30+, 16-30, 1-15 days overdue.
// Buckets with zero invoices are omitted from the result.
// Args: { value: Invoice[] }
const overdue_buckets = (args) => {
    const items = Array.isArray(args.value) ? args.value : [];
    const now = Date.now();
    const MS_PER_DAY = 86_400_000;
    const BUCKETS = [
        { key: '30+',   label: 'Over 30 days overdue',  min: 31, max: Infinity, tone: 'destructive' },
        { key: '16-30', label: '16 to 30 days overdue', min: 16, max: 30,       tone: 'warning'     },
        { key: '1-15',  label: '1 to 15 days overdue',  min: 1,  max: 15,       tone: 'muted'       },
    ];
    let grandTotal = 0;
    let grandCount = 0;
    const buckets = BUCKETS.map((b) => {
        let count = 0;
        let total = 0;
        for (const item of items) {
            const due = new Date(String(item['DueDate'])).getTime();
            if (!Number.isFinite(due))
                continue;
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
// ── ar_by_customer ───────────────────────────────────────────────────
// Aggregates open invoices by customer to produce a per-customer AR summary.
// Accepts optional sortCol ("name" | "invoiceCount" | "total") and
// sortDir ("asc" | "desc") to drive column-header sorting.
// Returns { entries: [{ uid, name, total, invoiceCount, overdueCount,
//   maxDaysOverdue, badgeText, badgeTone }], grandTotal, customerCount }
// Args: { value: Invoice[], sortCol?: string, sortDir?: string }
const ar_by_customer = (args) => {
    const items = Array.isArray(args.value) ? args.value : [];
    const now = Date.now();
    const MS_PER_DAY = 86_400_000;
    const sortCol = String(args.sortCol ?? 'name');
    const sortDir = String(args.sortDir ?? 'asc');
    const map = new Map();
    for (const item of items) {
        const customer = item['Customer'];
        const uid = String(customer?.['UID'] ?? 'unknown');
        const name = String(customer?.['Name'] ?? 'Unknown');
        const amount = Number(item['BalanceDueAmount']) || 0;
        const due = new Date(String(item['DueDate'])).getTime();
        const daysOverdue = Number.isFinite(due) ? Math.max(0, Math.floor((now - due) / MS_PER_DAY)) : 0;
        const existing = map.get(uid);
        if (existing) {
            existing.total += amount;
            existing.invoiceCount += 1;
            if (daysOverdue > 0) existing.overdueCount += 1;
            if (daysOverdue > existing.maxDaysOverdue) existing.maxDaysOverdue = daysOverdue;
        } else {
            map.set(uid, { uid, name, total: amount, invoiceCount: 1,
                overdueCount: daysOverdue > 0 ? 1 : 0, maxDaysOverdue: daysOverdue });
        }
    }
    let grandTotal = 0;
    const entries = Array.from(map.values())
        .sort((a, b) => {
            let cmp = 0;
            if (sortCol === 'invoiceCount') cmp = a.invoiceCount - b.invoiceCount;
            else if (sortCol === 'total') cmp = a.total - b.total;
            else cmp = a.name.localeCompare(b.name);
            return sortDir === 'desc' ? -cmp : cmp;
        })
        .map((e) => {
            grandTotal += e.total;
            const badgeTone = e.maxDaysOverdue > 30 ? 'destructive'
                : e.maxDaysOverdue > 0 ? 'warning' : '';
            const badgeText = e.overdueCount > 0
                ? `${e.overdueCount} overdue`
                : `${e.invoiceCount} invoice${e.invoiceCount !== 1 ? 's' : ''}`;
            return { ...e, badgeText, badgeTone };
        });
    return { entries, grandTotal, customerCount: entries.length };
};
// ── due_tone ─────────────────────────────────────────────────────────
// Returns a tone string based on how overdue a due date is.
// "destructive" if past due, "warning" if due within 7 days, "" otherwise.
// Args: { value: string }
const due_tone = (args) => {
    const raw = String(args.value ?? '');
    if (!raw) return '';
    const msMatch = raw.match(/\/Date\((-?\d+)(?:[+-]\d{4})?\)\//);
    const due = msMatch ? Number(msMatch[1]) : new Date(raw).getTime();
    if (!Number.isFinite(due)) return '';
    const days = Math.floor((due - Date.now()) / 86_400_000);
    if (days < 0) return 'destructive';
    if (days <= 7) return 'warning';
    return '';
};
// ── sort_items ───────────────────────────────────────────────────────
// Sorts an array of objects by a dot/slash-delimited field path.
// Numeric fields are compared numerically; others use localeCompare.
// Returns a new sorted array; does not mutate the input.
// Args: { value: object[], field: string, dir: "asc" | "desc" }
const sort_items = (args) => {
    const items = Array.isArray(args.value) ? args.value : [];
    const field = String(args.field ?? '');
    const dir = String(args.dir ?? 'asc');
    if (!field || items.length === 0) return items;
    const getVal = (item) => {
        const parts = field.split('/');
        let val = item;
        for (const part of parts) {
            if (val != null && typeof val === 'object') {
                val = val[part];
            } else { return undefined; }
        }
        return val;
    };
    return [...items].sort((a, b) => {
        const av = getVal(a), bv = getVal(b);
        let cmp;
        if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
        else cmp = String(av ?? '').localeCompare(String(bv ?? ''));
        return dir === 'desc' ? -cmp : cmp;
    });
};
// ── sort_toggle_dir ──────────────────────────────────────────────────
// Returns the next sort direction when a column header is clicked.
// Toggles asc→desc when clicking the already-active column; resets to
// "asc" when switching to a different column.
// Args: { col: string, currentCol: string, currentDir: string }
const sort_toggle_dir = (args) => {
    const col = String(args.col ?? '');
    const currentCol = String(args.currentCol ?? '');
    const currentDir = String(args.currentDir ?? 'asc');
    if (col === currentCol && currentDir === 'asc') return 'desc';
    return 'asc';
};
// ── format_date ──────────────────────────────────────────────────────
// Formats a date value to "d MMMM YYYY" (e.g. "15 January 2026").
// Handles ISO strings and MYOB /Date(ms+tz)/ format.
// Args: { value: string }
const format_date = (args) => {
    const raw = String(args.value ?? '');
    if (!raw) return '';
    const msMatch = raw.match(/\/Date\((-?\d+)(?:[+-]\d{4})?\)\//);
    const d = msMatch ? new Date(Number(msMatch[1])) : new Date(raw);
    if (isNaN(d.getTime())) return msMatch ? '' : raw;
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
};
// ── sort_label ───────────────────────────────────────────────────────
// Appends a ↑ or ↓ arrow to a column header label when it is the active
// sort column, so users can see which column is sorted and in what direction.
// Args: { label: string, col: string, currentCol: string, currentDir: string }
const sort_label = (args) => {
    const label = String(args.label ?? '');
    const col = String(args.col ?? '');
    const currentCol = String(args.currentCol ?? '');
    const currentDir = String(args.currentDir ?? 'asc');
    if (col !== currentCol) return label;
    return label + (currentDir === 'asc' ? ' ↑' : ' ↓');
};
// ── pnl_get ──────────────────────────────────────────────────────────────────
// Extracts a summary amount from a MYOB ProfitAndLoss report object.
// Tries top-level fields, then DisplayID matching, then title matching.
// For income/expenses sums all matching sections (handles split sections).
// Args: { value: PnLReport, key: "income" | "expenses" | "netProfit" | "grossProfit" }
const pnl_get = (args) => {
    const r = args.value;
    const key = String(args.key ?? '');
    if (!r) return 0;
    const candidates = {
        income:      ['IncomeTotal', 'TotalIncome'],
        expenses:    ['ExpenseTotal', 'TotalExpenses', 'OperatingExpensesTotal'],
        netProfit:   ['NetProfit', 'NetIncome'],
        grossProfit: ['GrossProfit'],
    };
    for (const field of (candidates[key] ?? [])) {
        const v = r[field];
        if (typeof v === 'number') return v;
        if (v && typeof v === 'object' && v.Amount !== undefined) return Number(v.Amount);
    }
    const sections = Array.isArray(r.Sections) ? r.Sections : [];
    const displayIds = {
        income:      ['income', 'trading_income', 'other_income', 'tradingincome'],
        expenses:    ['expense', 'expenses', 'operating_expense', 'cost_of_sales', 'costofsal'],
        netProfit:   ['net_profit', 'netprofit'],
        grossProfit: ['gross_profit', 'grossprofit'],
    };
    const titleTerms = {
        income: 'income', expenses: 'expens',
        netProfit: 'net profit', grossProfit: 'gross profit',
    };
    const term = titleTerms[key] ?? '';
    if (key === 'income' || key === 'expenses') {
        let total = 0;
        for (const s of sections) {
            const did = String(s.DisplayID ?? '').toLowerCase().replace(/[-\s]/g, '_');
            const title = String(s.Title ?? '').toLowerCase();
            const byId = (displayIds[key] ?? []).some(id => did.includes(id));
            const byTitle = title.includes(term) && !title.includes('net') && !title.includes('gross') && !title.includes('total');
            if (byId || byTitle) total += Number(s.Total?.Amount ?? 0);
        }
        if (total !== 0) return total;
    }
    for (const s of sections) {
        const did = String(s.DisplayID ?? '').toLowerCase().replace(/[-\s]/g, '_');
        const title = String(s.Title ?? '').toLowerCase();
        const byId = (displayIds[key] ?? []).some(id => did.includes(id));
        const byTitle = term && title.includes(term);
        if (byId || byTitle) return Number(s.Total?.Amount ?? 0);
    }
    return 0;
};
// ── pnl_entries ──────────────────────────────────────────────────────────────
// Returns account-level entries from matching P&L sections shaped for BarChart.
// Handles split sections (e.g. Trading Income + Other Income both contribute).
// Returns [{ name: string, amount: number }] filtered to non-zero amounts.
// Args: { value: PnLReport, section: "income" | "expenses" }
const pnl_entries = (args) => {
    const r = args.value;
    const section = String(args.section ?? 'income');
    if (!r) return [];
    const sections = Array.isArray(r.Sections) ? r.Sections : [];
    const incomeIds = ['income', 'trading_income', 'other_income', 'tradingincome'];
    const expenseIds = ['expense', 'expenses', 'operating_expense', 'cost_of_sales', 'other_expense'];
    const targetIds = section === 'income' ? incomeIds : expenseIds;
    const term = section === 'income' ? 'income' : 'expens';
    const results = [];
    for (const s of sections) {
        const did = String(s.DisplayID ?? '').toLowerCase().replace(/[-\s]/g, '_');
        const title = String(s.Title ?? '').toLowerCase();
        const byId = targetIds.some(id => did.includes(id));
        const byTitle = title.includes(term) && !title.includes('net') && !title.includes('gross') && !title.includes('total');
        if (!byId && !byTitle) continue;
        const entries = Array.isArray(s.Entries) ? s.Entries : [];
        for (const e of entries) {
            const name = String(e.Account?.Name ?? e.Title ?? 'Other');
            const amount = Math.abs(Number(e.Amount ?? 0));
            if (amount > 0) results.push({ name, amount });
        }
    }
    return results;
};
// ── pnl_debug ────────────────────────────────────────────────────────────────
// Returns a diagnostic string showing P&L section titles, DisplayIDs, and totals.
// Used to verify the actual MYOB API response structure.
// Args: { value: PnLReport }
const pnl_debug = (args) => {
    const r = args.value;
    if (!r) return 'no data';
    const sections = Array.isArray(r.Sections) ? r.Sections : [];
    if (sections.length === 0) {
        return `no sections — keys: ${Object.keys(r).join(', ')}`;
    }
    return sections.map(s => `[${s.DisplayID ?? '?'}] ${s.Title}: ${s.Total?.Amount ?? '?'}`).join(' | ');
};
// ── pnl_summary_bars ─────────────────────────────────────────────────────────
// Builds [{label, amount}] for Income, Expenses, and Net Profit totals.
// Suitable for use as BarChart data for a top-level P&L overview.
// Args: { value: PnLReport }
const pnl_summary_bars = (args) => {
    const r = args.value;
    if (!r) return [];
    const get = (key) => Number(pnl_get({ value: r, key }) ?? 0);
    return [
        { label: 'Income',     amount: get('income')    },
        { label: 'Expenses',   amount: get('expenses')  },
        { label: 'Net Profit', amount: get('netProfit') },
    ];
};
// ── flatten_invoices ─────────────────────────────────────────────────
// Flattens MYOB invoice items into display-ready flat rows for Table.
// Extracts nested Customer.Name, Terms.DueDate and pre-formats date/amount.
// Adds dueDateTone: "destructive" when the due date is in the past.
// Args: { value: Invoice[] }
const flatten_invoices = (args) => {
    const items = Array.isArray(args.value) ? args.value : [];
    const now = Date.now();
    const parseDue = (raw) => {
        if (!raw) return NaN;
        const ms = raw.match(/\/Date\((-?\d+)(?:[+-]\d{4})?\)\//);
        return ms ? Number(ms[1]) : new Date(raw).getTime();
    };
    const fmtDate = (raw) => {
        if (!raw) return '';
        const d = new Date(parseDue(raw));
        return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
    };
    const fmtAmt = (n) => {
        const v = Number(n);
        if (!Number.isFinite(v)) return '';
        return 'A$' + new Intl.NumberFormat('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
    };
    return items.map(item => {
        const rawDue = String(item.Terms?.DueDate ?? '');
        const dueMs = parseDue(rawDue);
        return {
            customerName: String(item.Customer?.Name ?? ''),
            number: String(item.Number ?? ''),
            dueDate: fmtDate(rawDue),
            rawDue,
            dueDateTone: Number.isFinite(dueMs) && dueMs < now ? 'destructive' : '',
            amount: fmtAmt(item.BalanceDueAmount),
        };
    });
};
// ── flatten_bills ─────────────────────────────────────────────────────
// Flattens MYOB bill items into display-ready flat rows for Table.
// Extracts nested Supplier.Name, Terms.DueDate and pre-formats date/amount.
// Adds dueDateTone: "destructive" when the due date is in the past.
// Args: { value: Bill[] }
const flatten_bills = (args) => {
    const items = Array.isArray(args.value) ? args.value : [];
    const now = Date.now();
    const parseDue = (raw) => {
        if (!raw) return NaN;
        const ms = raw.match(/\/Date\((-?\d+)(?:[+-]\d{4})?\)\//);
        return ms ? Number(ms[1]) : new Date(raw).getTime();
    };
    const fmtDate = (raw) => {
        if (!raw) return '';
        const d = new Date(parseDue(raw));
        return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
    };
    const fmtAmt = (n) => {
        const v = Number(n);
        if (!Number.isFinite(v)) return '';
        return 'A$' + new Intl.NumberFormat('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
    };
    return items.map(item => {
        const rawDue = String(item.Terms?.DueDate ?? '');
        const dueMs = parseDue(rawDue);
        return {
            supplierName: String(item.Supplier?.Name ?? ''),
            number: String(item.Number ?? ''),
            dueDate: fmtDate(rawDue),
            rawDue,
            dueDateTone: Number.isFinite(dueMs) && dueMs < now ? 'destructive' : '',
            amount: fmtAmt(item.BalanceDueAmount),
        };
    });
};
// ── is_overdue ───────────────────────────────────────────────────────
// Returns 'destructive' if the date is in the past, 'default' otherwise.
// Strips a leading "TDD:" prefix if present, then handles MYOB
// /Date(ms+tz)/ format and ISO strings.
// Args: { value: string }
const is_overdue = (args) => {
    const raw = String(args.value ?? '');
    if (!raw) return 'default';
    const stripped = raw.startsWith('TDD:') ? raw.slice(4) : raw;
    const msMatch = stripped.match(/\/Date\((-?\d+)(?:[+-]\d{4})?\)\//);
    const due = msMatch ? Number(msMatch[1]) : new Date(stripped).getTime();
    if (!Number.isFinite(due)) return 'default';
    return due < Date.now() ? 'destructive' : 'default';
};
const elements = {
    slug: 'myob-accounting',
    functions: {
        format_currency,
        format_date,
        due_tone,
        overdue_buckets,
        ar_by_customer,
        sort_items,
        sort_toggle_dir,
        sort_label,
        pnl_get,
        pnl_entries,
        pnl_debug,
        pnl_summary_bars,
        flatten_invoices,
        flatten_bills,
        is_overdue,
    },
};
export default elements;
