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
        { key: '30+', label: 'Over 30 days overdue', min: 31, max: Infinity, tone: 'destructive' },
        { key: '16-30', label: '16 to 30 days overdue', min: 16, max: 30, tone: 'warning' },
        { key: '1-15', label: '1 to 15 days overdue', min: 1, max: 15, tone: 'muted' },
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
            if (daysOverdue > 0)
                existing.overdueCount += 1;
            if (daysOverdue > existing.maxDaysOverdue)
                existing.maxDaysOverdue = daysOverdue;
        }
        else {
            map.set(uid, { uid, name, total: amount, invoiceCount: 1,
                overdueCount: daysOverdue > 0 ? 1 : 0, maxDaysOverdue: daysOverdue });
        }
    }
    let grandTotal = 0;
    const entries = Array.from(map.values())
        .sort((a, b) => {
        let cmp = 0;
        if (sortCol === 'invoiceCount')
            cmp = a.invoiceCount - b.invoiceCount;
        else if (sortCol === 'total')
            cmp = a.total - b.total;
        else
            cmp = a.name.localeCompare(b.name);
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
// Args: { value: string } — ISO date string or MYOB /Date(ms)/ format
const due_tone = (args) => {
    const raw = String(args.value ?? '');
    if (!raw)
        return '';
    const msMatch = raw.match(/\/Date\((-?\d+)(?:[+-]\d{4})?\)\//);
    const due = msMatch ? Number(msMatch[1]) : new Date(raw).getTime();
    if (!Number.isFinite(due))
        return '';
    const days = Math.floor((due - Date.now()) / 86_400_000);
    if (days < 0)
        return 'destructive';
    if (days <= 7)
        return 'warning';
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
    if (!field || items.length === 0)
        return items;
    const getVal = (item) => {
        const parts = field.split('/');
        let val = item;
        for (const part of parts) {
            if (val != null && typeof val === 'object') {
                val = val[part];
            }
            else {
                return undefined;
            }
        }
        return val;
    };
    return [...items].sort((a, b) => {
        const av = getVal(a), bv = getVal(b);
        let cmp;
        if (typeof av === 'number' && typeof bv === 'number')
            cmp = av - bv;
        else
            cmp = String(av ?? '').localeCompare(String(bv ?? ''));
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
    if (col === currentCol && currentDir === 'asc')
        return 'desc';
    return 'asc';
};
// ── format_date ──────────────────────────────────────────────────────
// Formats a date value to "d MMMM YYYY" (e.g. "15 January 2026").
// Handles ISO strings and MYOB /Date(ms+tz)/ format.
// Args: { value: string }
const format_date = (args) => {
    const raw = String(args.value ?? '');
    if (!raw)
        return '';
    const msMatch = raw.match(/\/Date\((-?\d+)(?:[+-]\d{4})?\)\//);
    const d = msMatch ? new Date(Number(msMatch[1])) : new Date(raw);
    if (isNaN(d.getTime()))
        return msMatch ? '' : raw;
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
    if (col !== currentCol)
        return label;
    return label + (currentDir === 'asc' ? ' ↑' : ' ↓');
};
// ── pnl_get ──────────────────────────────────────────────────────────
// Extracts a summary amount from a MYOB ProfitAndLoss report object.
// Tries top-level fields, then DisplayID matching, then title matching.
// For income/expenses sums all matching sections (handles split sections).
// Args: { value: PnLReport, key: "income" | "expenses" | "netProfit" | "grossProfit" }
const pnl_get = (args) => {
    let r = args.value;
    const key = String(args.key ?? '');
    if (!r)
        return 0;
    // Auto-unwrap common MCP response wrapper keys ({ data: {...} })
    if (typeof r === 'object' && !Array.isArray(r) &&
        r.data != null && typeof r.data === 'object' && !Array.isArray(r.data)) {
        r = r.data;
    }
    // Handle /Report/ProfitAndLossSummary — flat AccountsBreakdown array.
    // Standard MYOB account number prefixes: 4-/8- = Income, 5-/6-/9- = Expenses.
    const accounts = Array.isArray(r.AccountsBreakdown)
        ? r.AccountsBreakdown
        : [];
    if (accounts.length > 0) {
        const did = (a) => String(a.Account?.DisplayID ?? '');
        const sum = (arr) => arr.reduce((s, a) => s + Number(a.AccountTotal ?? 0), 0);
        const income = accounts.filter(a => /^[48]-/.test(did(a)));
        const cos = accounts.filter(a => /^5-/.test(did(a)));
        const expenses = accounts.filter(a => /^[569]-/.test(did(a)));
        if (key === 'income')
            return sum(income);
        if (key === 'expenses')
            return sum(expenses);
        if (key === 'grossProfit')
            return sum(income) - sum(cos);
        if (key === 'netProfit')
            return sum(income) - sum(expenses);
    }
    // Try known top-level summary fields
    const candidates = {
        income: ['IncomeTotal', 'TotalIncome'],
        expenses: ['ExpenseTotal', 'TotalExpenses', 'OperatingExpensesTotal'],
        netProfit: ['NetProfit', 'NetIncome'],
        grossProfit: ['GrossProfit'],
    };
    for (const field of (candidates[key] ?? [])) {
        const v = r[field];
        if (typeof v === 'number')
            return v;
        if (v && typeof v === 'object' && v.Amount !== undefined)
            return Number(v.Amount);
    }
    const sections = Array.isArray(r.Sections)
        ? r.Sections
        : [];
    // DisplayID matching (MYOB AccountRight uses camelCase/snake_case DisplayIDs)
    const displayIds = {
        income: ['income', 'trading_income', 'other_income', 'tradingincome'],
        expenses: ['expense', 'expenses', 'operating_expense', 'cost_of_sales', 'costofsal'],
        netProfit: ['net_profit', 'netprofit'],
        grossProfit: ['gross_profit', 'grossprofit'],
    };
    const titleTerms = {
        income: 'income', expenses: 'expens',
        netProfit: 'net profit', grossProfit: 'gross profit',
    };
    const term = titleTerms[key] ?? '';
    // For income/expenses: sum all matching sections (handles split Trading + Other sections)
    if (key === 'income' || key === 'expenses') {
        let total = 0;
        for (const s of sections) {
            const did = String(s.DisplayID ?? '').toLowerCase().replace(/[-\s]/g, '_');
            const title = String(s.Title ?? '').toLowerCase();
            const byId = (displayIds[key] ?? []).some(id => did.includes(id));
            const byTitle = title.includes(term)
                && !title.includes('net')
                && !title.includes('gross')
                && !title.includes('total');
            if (byId || byTitle) {
                total += Number(s.Total?.Amount ?? 0);
            }
        }
        if (total !== 0)
            return total;
    }
    // For netProfit / grossProfit: return first match
    for (const s of sections) {
        const did = String(s.DisplayID ?? '').toLowerCase().replace(/[-\s]/g, '_');
        const title = String(s.Title ?? '').toLowerCase();
        const byId = (displayIds[key] ?? []).some(id => did.includes(id));
        const byTitle = term && title.includes(term);
        if (byId || byTitle) {
            return Number(s.Total?.Amount ?? 0);
        }
    }
    return 0;
};
// ── pnl_entries ──────────────────────────────────────────────────────
// Returns account-level entries from matching P&L sections shaped for BarChart.
// Handles split sections (e.g. Trading Income + Other Income both contribute).
// Returns [{ name: string, amount: number }] filtered to non-zero amounts.
// Args: { value: PnLReport, section: "income" | "expenses" }
const pnl_entries = (args) => {
    const r = args.value;
    const section = String(args.section ?? 'income');
    if (!r)
        return [];
    // Handle AccountsBreakdown format from /Report/ProfitAndLossSummary
    const accounts = Array.isArray(r.AccountsBreakdown)
        ? r.AccountsBreakdown
        : [];
    if (accounts.length > 0) {
        const getDid = (a) => String(a.Account?.DisplayID ?? '');
        const isIncome = (a) => /^[48]-/.test(getDid(a));
        const isExpense = (a) => /^[569]-/.test(getDid(a));
        return accounts
            .filter(section === 'income' ? isIncome : isExpense)
            .map(a => ({
            name: String(a.Account?.Name ?? 'Other'),
            amount: Math.abs(Number(a.AccountTotal ?? 0)),
        }))
            .filter(e => e.amount > 0);
    }
    const sections = Array.isArray(r.Sections)
        ? r.Sections
        : [];
    const incomeIds = ['income', 'trading_income', 'other_income', 'tradingincome'];
    const expenseIds = ['expense', 'expenses', 'operating_expense', 'cost_of_sales', 'other_expense'];
    const targetIds = section === 'income' ? incomeIds : expenseIds;
    const term = section === 'income' ? 'income' : 'expens';
    const results = [];
    for (const s of sections) {
        const did = String(s.DisplayID ?? '').toLowerCase().replace(/[-\s]/g, '_');
        const title = String(s.Title ?? '').toLowerCase();
        const byId = targetIds.some(id => did.includes(id));
        const byTitle = title.includes(term)
            && !title.includes('net')
            && !title.includes('gross')
            && !title.includes('total');
        if (!byId && !byTitle)
            continue;
        const entries = Array.isArray(s.Entries)
            ? s.Entries
            : [];
        for (const e of entries) {
            const acct = e.Account;
            const name = String(acct?.Name ?? e.Title ?? 'Other');
            const amount = Math.abs(Number(e.Amount ?? 0));
            if (amount > 0)
                results.push({ name, amount });
        }
    }
    return results;
};
// ── pnl_debug ────────────────────────────────────────────────────────
// Returns a diagnostic string showing the P&L section titles and their totals.
// Also detects MCP wrapper keys so the correct state path can be identified.
// Args: { value: PnLReport }
const pnl_debug = (args) => {
    const raw = args.value;
    if (!raw)
        return 'pnl_debug: null/undefined';
    const topKeys = Object.keys(raw).join(', ');
    // Detect wrapper key
    let r = raw;
    if (raw.data != null && typeof raw.data === 'object' && !Array.isArray(raw.data)) {
        r = raw.data;
        return `wrapped{data}: inner keys: ${Object.keys(r).join(', ')}`;
    }
    const sections = Array.isArray(r.Sections) ? r.Sections : [];
    if (sections.length === 0) {
        return `no sections — top-level keys: ${topKeys}`;
    }
    return sections.map((s) => {
        const did = s.DisplayID ?? '?';
        const total = s.Total?.Amount ?? '?';
        return `[${did}] ${s.Title}: ${total}`;
    }).join(' | ');
};
// ── format_json ──────────────────────────────────────────────────────
// Returns a short JSON preview of any value — used for debugging raw
// MCP state so we can see exactly what the platform received.
// Truncates at 500 chars to avoid flooding the UI.
// Args: { value: unknown }
const format_json = (args) => {
    const v = args.value;
    if (v === null || v === undefined)
        return 'state: null/undefined';
    if (typeof v !== 'object')
        return `state: ${String(v)}`;
    if (Array.isArray(v))
        return `state: array[${v.length}]`;
    try {
        const s = JSON.stringify(v);
        return s.length > 500 ? s.slice(0, 500) + '…' : s;
    }
    catch {
        return `state: object(keys: ${Object.keys(v).join(', ')})`;
    }
};
// ── pnl_spark_values ─────────────────────────────────────────────────
// Extracts [income, expenses, netProfit] as a flat number array for
// use as Sparkline `values`. Always returns exactly 3 numbers.
// Args: { value: PnLReport }
const pnl_spark_values = (args) => {
    const r = args.value;
    if (!r)
        return [0, 0, 0];
    const get = (key) => Number(pnl_get({ value: r, key }) ?? 0);
    return [get('income'), get('expenses'), Math.abs(get('netProfit'))];
};
// ── pnl_summary_bars ─────────────────────────────────────────────────
// Builds [{label, amount}] for Income, Expenses, and Net Profit totals.
// Suitable for use as BarChart data for a top-level P&L overview.
// Args: { value: PnLReport }
const pnl_summary_bars = (args) => {
    const r = args.value;
    if (!r)
        return [];
    const get = (key) => Number(pnl_get({ value: r, key }) ?? 0);
    return [
        { label: 'Income', amount: get('income') },
        { label: 'Expenses', amount: get('expenses') },
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
        if (!raw)
            return NaN;
        const ms = raw.match(/\/Date\((-?\d+)(?:[+-]\d{4})?\)\//);
        return ms ? Number(ms[1]) : new Date(raw).getTime();
    };
    const fmtDate = (raw) => {
        if (!raw)
            return '';
        const t = parseDue(raw);
        const d = new Date(t);
        return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
    };
    const fmtAmt = (n) => {
        const v = Number(n);
        if (!Number.isFinite(v))
            return '';
        return 'A$' + new Intl.NumberFormat('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
    };
    return items.map(item => {
        const customer = item.Customer;
        const terms = item.Terms;
        const rawDue = String(terms?.DueDate ?? '');
        const dueMs = parseDue(rawDue);
        return {
            customerName: String(customer?.Name ?? ''),
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
        if (!raw)
            return NaN;
        const ms = raw.match(/\/Date\((-?\d+)(?:[+-]\d{4})?\)\//);
        return ms ? Number(ms[1]) : new Date(raw).getTime();
    };
    const fmtDate = (raw) => {
        if (!raw)
            return '';
        const t = parseDue(raw);
        const d = new Date(t);
        return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });
    };
    const fmtAmt = (n) => {
        const v = Number(n);
        if (!Number.isFinite(v))
            return '';
        return 'A$' + new Intl.NumberFormat('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
    };
    return items.map(item => {
        const supplier = item.Supplier;
        const terms = item.Terms;
        const rawDue = String(terms?.DueDate ?? '');
        const dueMs = parseDue(rawDue);
        return {
            supplierName: String(supplier?.Name ?? ''),
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
    if (!raw)
        return 'default';
    const stripped = raw.startsWith('TDD:') ? raw.slice(4) : raw;
    const msMatch = stripped.match(/\/Date\((-?\d+)(?:[+-]\d{4})?\)\//);
    const due = msMatch ? Number(msMatch[1]) : new Date(stripped).getTime();
    if (!Number.isFinite(due))
        return 'default';
    return due < Date.now() ? 'destructive' : 'default';
};
// ── monthly_totals ────────────────────────────────────────────────────
// Groups invoice/bill Items by issue month (Date field) and sums TotalAmount.
// Args: { value: Item[] | { Items: Item[] }, months: string[] }  (months: "YYYY-MM")
// Returns: number[] matching the months array order.
const monthly_totals = (args) => {
    const raw = args.value;
    const items = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.Items)
            ? raw.Items
            : [];
    const months = Array.isArray(args.months) ? args.months : [];
    const parse = (s) => {
        const m = s.match(/\/Date\((-?\d+)(?:[+-]\d{4})?\)\//);
        return m ? Number(m[1]) : new Date(s).getTime();
    };
    const totals = {};
    for (const item of items) {
        const ts = parse(String(item.Date ?? ''));
        if (!isFinite(ts))
            continue;
        const d = new Date(ts);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        totals[ym] = (totals[ym] ?? 0) + Number(item.TotalAmount ?? 0);
    }
    return months.map(m => Math.round((totals[m] ?? 0) * 100) / 100);
};
// MYOB Purchase Bill types — anything else (e.g. InventoryAdjustment) is treated as an adjustment.
const PURCHASE_BILL_TYPES = new Set(['Item', 'Miscellaneous', 'Professional', 'Service']);
// ── txn_count ─────────────────────────────────────────────────────────
// Returns count (as string) of invoice/bill Items with optional filters.
// filter: "all" | "open" | "closed" | "overdue"  (MYOB bills use "Paid" for closed)
// from_date / to_date: YYYY-MM-DD — scopes to item Date field
// record_type: "bill" | "adjustment" — splits by MYOB Type field
const txn_count = (args) => {
    const raw = args.value;
    const items = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.Items)
            ? raw.Items
            : [];
    const filter = String(args.filter ?? 'all').toLowerCase();
    const recordType = args.record_type ? String(args.record_type) : null;
    const fromMs = args.from_date ? new Date(String(args.from_date)).getTime() : null;
    const toMs = args.to_date
        ? (() => { const d = new Date(String(args.to_date)); d.setDate(d.getDate() + 1); return d.getTime(); })()
        : null;
    const now = Date.now();
    const parse = (s) => {
        const m = s.match(/\/Date\((-?\d+)(?:[+-]\d{4})?\)\//);
        return m ? Number(m[1]) : new Date(s).getTime();
    };
    return String(items.filter(item => {
        if (recordType === 'bill' && !PURCHASE_BILL_TYPES.has(String(item.Type ?? '')))
            return false;
        if (recordType === 'adjustment' && PURCHASE_BILL_TYPES.has(String(item.Type ?? '')))
            return false;
        if (fromMs !== null || toMs !== null) {
            const itemMs = parse(String(item.Date ?? ''));
            if (!isFinite(itemMs))
                return false;
            if (fromMs !== null && itemMs < fromMs)
                return false;
            if (toMs !== null && itemMs >= toMs)
                return false;
        }
        const status = String(item.Status ?? '').toLowerCase();
        const terms = item.Terms;
        const dueDateRaw = String(terms?.DueDate ?? item.DueDate ?? '');
        const dueMs = parse(dueDateRaw);
        const overdue = isFinite(dueMs) && dueMs < now && status === 'open';
        return filter === 'all'
            || (filter === 'open' && status === 'open')
            || (filter === 'closed' && (status === 'closed' || status === 'paid'))
            || (filter === 'overdue' && overdue);
    }).length);
};
// ── txn_amount ────────────────────────────────────────────────────────
// Returns formatted AUD total for invoice/bill Items with optional filters.
// Uses BalanceDueAmount for open/overdue; TotalAmount otherwise.
// from_date / to_date: YYYY-MM-DD — scopes to item Date field
// record_type: "bill" | "adjustment" — splits by MYOB Type field
const txn_amount = (args) => {
    const raw = args.value;
    const items = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.Items)
            ? raw.Items
            : [];
    const filter = String(args.filter ?? 'all').toLowerCase();
    const recordType = args.record_type ? String(args.record_type) : null;
    const fromMs = args.from_date ? new Date(String(args.from_date)).getTime() : null;
    const toMs = args.to_date
        ? (() => { const d = new Date(String(args.to_date)); d.setDate(d.getDate() + 1); return d.getTime(); })()
        : null;
    const now = Date.now();
    const parse = (s) => {
        const m = s.match(/\/Date\((-?\d+)(?:[+-]\d{4})?\)\//);
        return m ? Number(m[1]) : new Date(s).getTime();
    };
    const useBalance = filter === 'open' || filter === 'overdue';
    const total = items
        .filter(item => {
        if (recordType === 'bill' && !PURCHASE_BILL_TYPES.has(String(item.Type ?? '')))
            return false;
        if (recordType === 'adjustment' && PURCHASE_BILL_TYPES.has(String(item.Type ?? '')))
            return false;
        if (fromMs !== null || toMs !== null) {
            const itemMs = parse(String(item.Date ?? ''));
            if (!isFinite(itemMs))
                return false;
            if (fromMs !== null && itemMs < fromMs)
                return false;
            if (toMs !== null && itemMs >= toMs)
                return false;
        }
        const status = String(item.Status ?? '').toLowerCase();
        const terms = item.Terms;
        const dueDateRaw = String(terms?.DueDate ?? item.DueDate ?? '');
        const dueMs = parse(dueDateRaw);
        const overdue = isFinite(dueMs) && dueMs < now && status === 'open';
        return filter === 'all'
            || (filter === 'open' && status === 'open')
            || (filter === 'closed' && (status === 'closed' || status === 'paid'))
            || (filter === 'overdue' && overdue);
    })
        .reduce((sum, item) => {
        return sum + Number(useBalance
            ? (item.BalanceDueAmount ?? item.TotalAmount ?? 0)
            : (item.TotalAmount ?? 0));
    }, 0);
    return 'A$' + new Intl.NumberFormat('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(total);
};
// ── txn_truncated ──────────────────────────────────────────────────────
// Returns true when the Items array is at the 1000-record page cap, meaning
// the API response was truncated and totals/counts may be understated.
const txn_truncated = (args) => {
    const raw = args.value;
    const items = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.Items)
            ? raw.Items
            : [];
    return items.length >= 1000;
};
// ── net_monthly ────────────────────────────────────────────────────────
// Subtracts expense monthly totals from income monthly totals element-wise.
// Args: { income: number[], expenses: number[] }
const net_monthly = (args) => {
    const inc = Array.isArray(args.income) ? args.income : [];
    const exp = Array.isArray(args.expenses) ? args.expenses : [];
    const len = Math.max(inc.length, exp.length);
    return Array.from({ length: len }, (_, i) => (inc[i] ?? 0) - (exp[i] ?? 0));
};
// ── bool_not ───────────────────────────────────────────────────────────
// Negates a boolean — used for collapsible section toggle visibility.
const bool_not = (args) => !args.value;
const elements = {
    slug: 'myob-accounting',
    functions: {
        format_currency,
        format_date,
        format_json,
        due_tone,
        overdue_buckets,
        ar_by_customer,
        sort_items,
        sort_toggle_dir,
        sort_label,
        pnl_get,
        pnl_entries,
        pnl_debug,
        pnl_spark_values,
        pnl_summary_bars,
        flatten_invoices,
        flatten_bills,
        is_overdue,
        monthly_totals,
        txn_count,
        txn_amount,
        txn_truncated,
        net_monthly,
        bool_not,
    },
};
export default elements;
