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
            const terms = (item.Terms ?? item.terms);
            const rawDue = String(terms?.DueDate ?? item['DueDate'] ?? '');
            const due = new Date(rawDue).getTime();
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
    // eslint-disable-next-line no-console
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
// ── flatten_overdue_invoices ──────────────────────────────────────────
// Filters open invoice Items to only overdue ones, computes days_overdue,
// sorts by most overdue first, and returns aggregated stats.
// Returns { rows, totalOverdue, overdueCount, oldestDays, avgDays }
// Args: { value: Invoice[] }
const flatten_overdue_invoices = (args) => {
    const items = Array.isArray(args.value) ? args.value : [];
    const now = Date.now();
    const MS_PER_DAY = 86_400_000;
    const parseDue = (raw) => {
        if (!raw)
            return NaN;
        const ms = raw.match(/\/Date\((-?\d+)(?:[+-]\d{4})?\)\//);
        return ms ? Number(ms[1]) : new Date(raw).getTime();
    };
    const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const fmtDate = (raw) => {
        const t = parseDue(raw);
        if (!Number.isFinite(t))
            return '';
        const d = new Date(t);
        return `${String(d.getDate()).padStart(2, '0')}-${MONTH_ABBR[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
    };
    const fmtAmt = (n) => {
        const v = Number(n);
        if (!Number.isFinite(v))
            return '';
        return 'A$' + new Intl.NumberFormat('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
    };
    const rows = [];
    let totalOverdue = 0;
    for (const item of items) {
        const terms = (item.Terms ?? item.terms);
        const rawDue = String(terms?.DueDate ?? item['DueDate'] ?? '');
        const dueMs = parseDue(rawDue);
        if (!Number.isFinite(dueMs))
            continue;
        const days = Math.floor((now - dueMs) / MS_PER_DAY);
        if (days < 1)
            continue;
        const customer = item.Customer;
        const amount = Number(item['BalanceDueAmount']) || 0;
        totalOverdue += amount;
        rows.push({
            id: String(item.UID ?? item.Number ?? rows.length),
            number: String(item.Number ?? ''),
            customer_name: String(customer?.Name ?? ''),
            amount: fmtAmt(amount),
            days_overdue: days,
            due_date: fmtDate(rawDue),
        });
    }
    rows.sort((a, b) => b.days_overdue - a.days_overdue);
    const overdueCount = rows.length;
    const oldestDays = rows.length > 0 ? rows[0].days_overdue : 0;
    const avgDays = overdueCount > 0
        ? Math.round(rows.reduce((s, r) => s + r.days_overdue, 0) / overdueCount)
        : 0;
    return { rows, totalOverdue, overdueCount, oldestDays, avgDays };
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
// overdue_asof: YYYY-MM-DD — cutoff for overdue; defaults to today when omitted
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
    const now = args.overdue_asof ? new Date(String(args.overdue_asof)).getTime() : Date.now();
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
// overdue_asof: YYYY-MM-DD — cutoff for overdue; defaults to today when omitted
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
    const now = args.overdue_asof ? new Date(String(args.overdue_asof)).getTime() : Date.now();
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
        // Prefer Subtotal (ex-tax); fall back to TotalAmount if missing.
        const subtotal = Number((item.Subtotal ?? item.SubTotal) ?? item.TotalAmount ?? 0);
        const totalAmt = Number(item.TotalAmount ?? 0);
        const balDue = Number(item.BalanceDueAmount ?? 0);
        let amt;
        if (useBalance) {
            amt = balDue;
        }
        else {
            amt = subtotal;
        }
        return sum + amt;
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
// ── cash_received ─────────────────────────────────────────────────────
// Sums MYOB ReceivePayment records by totalling Invoices[].AmountApplied.
// Returns formatted AUD. Returns A$0.00 when no payments in the period.
// Args: { value: ReceivePayment[] }
const cash_received = (args) => {
    const items = Array.isArray(args.value) ? args.value : [];
    const total = items.reduce((sum, payment) => {
        const invoices = Array.isArray(payment.Invoices)
            ? payment.Invoices
            : [];
        return sum + invoices.reduce((s, inv) => s + Number(inv.AmountApplied ?? 0), 0);
    }, 0);
    return 'A$' + new Intl.NumberFormat('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(total);
};
// ── bool_not ───────────────────────────────────────────────────────────
// Negates a boolean — used for collapsible section toggle visibility.
const bool_not = (args) => !args.value;
// ── three_month_window ─────────────────────────────────────────────────
// Returns the current 3-month calendar window: current month + 2 prior.
// MYOB P&L requires dates within the same Australian FY (Jul 1 – Jun 30).
// When the trailing window spans two FYs, the larger contiguous segment is
// used (e.g. Jul 2026 → May-Jun since those 2 months dominate FY2026).
// Optional { field } arg extracts a single key; omit for the full object.
// Fields: from_date, to_date, from_date_ly, to_date_ly,
//         months_cy, months_ly, month_0, month_1, month_2
const three_month_window = (args) => {
    const today = new Date();
    const cy = today.getFullYear();
    const cm = today.getMonth(); // 0-indexed
    const months = [cm - 2, cm - 1, cm].map((m) => {
        const year = cy + Math.floor(m / 12);
        const month = ((m % 12) + 12) % 12;
        return { year, month };
    });
    const pad = (n) => String(n).padStart(2, '0');
    const lastDay = (year, month) => new Date(year, month + 1, 0).getDate();
    const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const m0 = months[0];
    const m2 = months[months.length - 1];
    const from_date = `${m0.year}-${pad(m0.month + 1)}-01`;
    // Use today for the current (partial) month; end-of-month for completed months.
    const isCurrentMonth = m2.year === cy && m2.month === cm;
    const to_date = isCurrentMonth
        ? `${cy}-${pad(cm + 1)}-${pad(today.getDate())}`
        : `${m2.year}-${pad(m2.month + 1)}-${pad(lastDay(m2.year, m2.month))}`;
    const from_date_ly = `${m0.year - 1}-${pad(m0.month + 1)}-01`;
    const to_date_ly = isCurrentMonth
        ? `${cy - 1}-${pad(cm + 1)}-${pad(today.getDate())}`
        : `${m2.year - 1}-${pad(m2.month + 1)}-${pad(lastDay(m2.year - 1, m2.month))}`;
    const months_cy = months.map(({ year, month }) => `${year}-${pad(month + 1)}`);
    const months_ly = months.map(({ year, month }) => `${year - 1}-${pad(month + 1)}`);
    const month_0 = MONTH_NAMES[months[0].month];
    const month_1 = months.length > 1 ? MONTH_NAMES[months[1].month] : '';
    const month_2 = months.length > 2 ? MONTH_NAMES[months[2].month] : '';
    const window = { from_date, to_date, from_date_ly, to_date_ly, months_cy, months_ly, month_0, month_1, month_2 };
    const field = args?.field ? String(args.field) : null;
    if (field && Object.prototype.hasOwnProperty.call(window, field)) {
        return window[field];
    }
    return window;
};
// ── levenshtein_ratio ────────────────────────────────────────────────
// Classic edit-distance similarity ratio in [0, 1] — 1 means identical.
// Used internally by analyze_duplicate_contacts for fuzzy name matching.
const levenshtein_ratio = (a, b) => {
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
            dp[j] = a[i - 1] === b[j - 1]
                ? prev
                : 1 + Math.min(prev, dp[j], dp[j - 1]);
            prev = tmp;
        }
    }
    const dist = dp[n];
    return 1 - dist / Math.max(m, n);
};
// ── analyze_duplicate_contacts ──────────────────────────────────────
// Scans MYOB contacts and buckets likely duplicates by confidence:
//  - Critical:      two+ contacts share the same normalized email or phone.
//  - Needs Review:  two+ contacts share the same normalized display name
//                    (and weren't already caught by the email/phone match).
//  - Low Risk:      contacts with a highly similar (but not identical) name
//                    to another contact sharing its first name-token
//                    (Levenshtein ratio >= 0.82).
// A contact is only counted once, at its highest-confidence tier.
// Returns { totalDuplicates, critical: {count, pct}, needsReview: {count, pct},
//   lowRisk: {count, pct}, mostAffected: {label, count}, duplicateRatePct,
//   recordsScanned, lastScanAt }
// Args: { value: Contact[] }
const analyze_duplicate_contacts = (args) => {
    const items = Array.isArray(args.value) ? args.value : [];
    const normName = (s) => s.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
    const normEmail = (s) => s.toLowerCase().trim();
    const normPhone = (s) => s.replace(/\D/g, '');
    const records = items.map((item, i) => {
        const company = String(item.CompanyName ?? '').trim();
        const first = String(item.FirstName ?? '').trim();
        const last = String(item.LastName ?? '').trim();
        const name = company || `${first} ${last}`.trim();
        const addresses = Array.isArray(item.Addresses) ? item.Addresses : [];
        const email = String(addresses[0]?.Email ?? '');
        const phone = String(addresses[0]?.Phone1 ?? '');
        return {
            uid: String(item.UID ?? i),
            name,
            normName: normName(name),
            email: normEmail(email),
            phone: normPhone(phone),
        };
    }).filter((r) => r.name);
    const critical = new Set();
    const needsReview = new Set();
    const lowRisk = new Set();
    // Critical — exact email or exact phone match (phone requires 6+ digits
    // to avoid grouping contacts with blank/short placeholder numbers).
    const groupBy = (key, minLen = 1) => {
        const map = new Map();
        for (const r of records) {
            const k = key(r);
            if (k.length < minLen)
                continue;
            const arr = map.get(k) ?? [];
            arr.push(r.uid);
            map.set(k, arr);
        }
        return map;
    };
    for (const [, uids] of groupBy((r) => r.email)) {
        if (uids.length > 1)
            uids.forEach((u) => critical.add(u));
    }
    for (const [, uids] of groupBy((r) => r.phone, 6)) {
        if (uids.length > 1)
            uids.forEach((u) => critical.add(u));
    }
    // Needs Review — exact normalized name match, excluding contacts already critical.
    for (const [, uids] of groupBy((r) => r.normName)) {
        const remaining = uids.filter((u) => !critical.has(u));
        if (remaining.length > 1)
            remaining.forEach((u) => needsReview.add(u));
    }
    // Low Risk — fuzzy name match within same first-token bucket, excluding
    // anything already flagged at a higher tier.
    const byFirstToken = new Map();
    for (const r of records) {
        if (critical.has(r.uid) || needsReview.has(r.uid))
            continue;
        const token = r.normName.split(' ')[0] ?? '';
        if (!token)
            continue;
        const arr = byFirstToken.get(token) ?? [];
        arr.push(r);
        byFirstToken.set(token, arr);
    }
    for (const [, bucket] of byFirstToken) {
        if (bucket.length < 2)
            continue;
        for (let i = 0; i < bucket.length; i++) {
            for (let j = i + 1; j < bucket.length; j++) {
                if (bucket[i].normName === bucket[j].normName)
                    continue;
                if (levenshtein_ratio(bucket[i].normName, bucket[j].normName) >= 0.82) {
                    lowRisk.add(bucket[i].uid);
                    lowRisk.add(bucket[j].uid);
                }
            }
        }
    }
    const criticalCount = critical.size;
    const needsReviewCount = needsReview.size;
    const lowRiskCount = lowRisk.size;
    const totalDuplicates = criticalCount + needsReviewCount + lowRiskCount;
    const pct = (n) => (totalDuplicates > 0 ? Math.round((n / totalDuplicates) * 100) : 0);
    const recordsScanned = items.length;
    return {
        totalDuplicates,
        critical: { count: criticalCount, pct: pct(criticalCount) },
        needsReview: { count: needsReviewCount, pct: pct(needsReviewCount) },
        lowRisk: { count: lowRiskCount, pct: pct(lowRiskCount) },
        mostAffected: { label: 'Contacts', count: totalDuplicates },
        duplicateRatePct: recordsScanned > 0 ? Math.round((totalDuplicates / recordsScanned) * 1000) / 10 : 0,
        recordsScanned,
        lastScanAt: new Date().toISOString(),
    };
};
// ── analyze_myob_duplicates ───────────────────────────────────────────
// Cross-checks MYOB Contacts, Bills, and Invoices for likely duplicates,
// tiered EXACT / LIKELY / POSSIBLE by confidence, filterable by record
// type via matchMode-style category filtering handled spec-side.
//
// "Same Contact" below means the same CANONICAL contact — Contacts that
// are themselves flagged as duplicates of each other (shared email/phone,
// or an exact/fuzzy name hit) are merged into one cluster first, so a
// bill/invoice split across two duplicate contact records (e.g. "Acme
// Pty Ltd" vs "Acme Pty. Ltd.", both real records for the same vendor)
// still matches its counterpart under the sibling record — capped at
// LIKELY even when the amount/date line up exactly, since a match
// crossing a contact boundary is one inference hop weaker than a
// same-record match.
//
// Match rules:
//   Contacts  — reuses analyze_duplicate_contacts' tiers verbatim:
//               EXACT = shared normalized email or phone (6+ digits).
//               LIKELY = shared normalized display name (not already
//               EXACT). POSSIBLE = fuzzy name match (Levenshtein >=0.82)
//               within the same first-name-token bucket.
//   Bills     — EXACT: same (raw) Supplier + same non-blank
//               SupplierInvoiceNumber. LIKELY: same Supplier + same
//               TotalAmount, 0-2 days apart (not already EXACT), OR a
//               cross-contact same-day match. POSSIBLE: same Supplier +
//               same TotalAmount, 3-7 days apart.
//   Invoices  — same rules as Bills, using Customer +
//               CustomerPurchaseOrderNumber in place of Supplier +
//               SupplierInvoiceNumber.
//
// No MYOB Contact resource in this org exposes an ABN/tax-number field
// (confirmed against real data — Identifiers is always null), so contact
// matching relies on email/phone/name only, not ABN.
//
// detailRows: one row per flagged record, most-recent-Date-first —
// { category: 'Bill'|'Invoice'|'Contact', label, detail, tier, amount? }.
// filterCounts gives the per-category open count for the spec's filter
// tabs without a second pass over detailRows.
//
// `filter` ('' | 'Bill' | 'Invoice' | 'Contact') narrows detailRows/
// previewRows to one category — echoed back as `filter` in the result so
// the spec can highlight the active filter tab from the same state write
// that applied it, with no separate setState needed. previewRows is the
// current filter's top 3 (most-recent-tier-first); detailRows is the
// FULL current-filter list, for the "View all" table. totalOpen is
// always the grand (unfiltered) count, for the header's "N open" badge.
//
// Args: { contacts?: Contact[], bills?: Bill[], invoices?: Invoice[], filter?: string }
const analyze_myob_duplicates = (args) => {
    const contacts = Array.isArray(args.contacts) ? args.contacts : [];
    const bills = Array.isArray(args.bills) ? args.bills : [];
    const invoices = Array.isArray(args.invoices) ? args.invoices : [];
    const filter = ['Bill', 'Invoice', 'Contact'].includes(String(args.filter)) ? String(args.filter) : '';
    const parseDate = (raw) => {
        const s = String(raw ?? '');
        if (!s)
            return null;
        const m = s.match(/\/Date\((-?\d+)(?:[+-]\d{4})?\)\//);
        if (m)
            return Number(m[1]);
        const t = new Date(s).getTime();
        return Number.isFinite(t) ? t : null;
    };
    const daysBetween = (a, b) => {
        const ma = parseDate(a);
        const mb = parseDate(b);
        if (ma == null || mb == null)
            return Infinity;
        return Math.abs(ma - mb) / 86_400_000;
    };
    const dayKeyOf = (raw) => {
        const ms = parseDate(raw);
        return ms == null ? null : String(Math.floor(ms / 86_400_000));
    };
    const fmtAmt = (n) => {
        const v = Number(n);
        if (!Number.isFinite(v))
            return '';
        return 'A$' + new Intl.NumberFormat('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
    };
    const fmtDate = (raw) => {
        const ms = parseDate(raw);
        if (ms == null)
            return '';
        return new Date(ms).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
    };
    const daysApartPhrase = (n) => (n === 0 ? 'same day' : n === 1 ? '1 day apart' : `${n} days apart`);
    const detailRows = [];
    // ── Contacts — union-find over contact IDs, reusing the existing
    // critical/needsReview/lowRisk tiers to also build canonicalContact().
    const normName = (s) => s.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
    const normEmail = (s) => s.toLowerCase().trim();
    const normPhone = (s) => s.replace(/\D/g, '');
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
    const contactByUid = new Map();
    const crecs = contacts.map((item, i) => {
        const uid = String(item.UID ?? i);
        contactByUid.set(uid, item);
        const company = String(item.CompanyName ?? '').trim();
        const first = String(item.FirstName ?? '').trim();
        const last = String(item.LastName ?? '').trim();
        const name = company || `${first} ${last}`.trim();
        const addresses = Array.isArray(item.Addresses) ? item.Addresses : [];
        const email = String(addresses[0]?.Email ?? '');
        const phone = String(addresses[0]?.Phone1 ?? '');
        return { uid, name, normName: normName(name), email: normEmail(email), phone: normPhone(phone) };
    }).filter((r) => r.name);
    const contactTier = new Map();
    const groupBy = (recs, key, minLen = 1) => {
        const map = new Map();
        for (const r of recs) {
            const k = key(r);
            if (k.length < minLen)
                continue;
            (map.get(k) ?? map.set(k, []).get(k)).push(r.uid);
        }
        return map;
    };
    for (const [, uids] of groupBy(crecs, (r) => r.email)) {
        if (uids.length > 1) {
            uids.forEach((u) => contactTier.set(u, 'exact'));
            for (let i = 1; i < uids.length; i++)
                unionContacts(uids[0], uids[i]);
        }
    }
    for (const [, uids] of groupBy(crecs, (r) => r.phone, 6)) {
        if (uids.length > 1) {
            uids.forEach((u) => contactTier.set(u, 'exact'));
            for (let i = 1; i < uids.length; i++)
                unionContacts(uids[0], uids[i]);
        }
    }
    for (const [, uids] of groupBy(crecs, (r) => r.normName)) {
        const remaining = uids.filter((u) => contactTier.get(u) !== 'exact');
        if (remaining.length > 1) {
            remaining.forEach((u) => contactTier.set(u, 'likely'));
            for (let i = 1; i < remaining.length; i++)
                unionContacts(remaining[0], remaining[i]);
        }
    }
    const byFirstToken = new Map();
    for (const r of crecs) {
        if (contactTier.has(r.uid))
            continue;
        const token = r.normName.split(' ')[0] ?? '';
        if (!token)
            continue;
        (byFirstToken.get(token) ?? byFirstToken.set(token, []).get(token)).push(r);
    }
    for (const [, bucket] of byFirstToken) {
        for (let i = 0; i < bucket.length; i++) {
            for (let j = i + 1; j < bucket.length; j++) {
                if (bucket[i].normName === bucket[j].normName)
                    continue;
                if (levenshtein_ratio(bucket[i].normName, bucket[j].normName) >= 0.82) {
                    if (!contactTier.has(bucket[i].uid))
                        contactTier.set(bucket[i].uid, 'possible');
                    if (!contactTier.has(bucket[j].uid))
                        contactTier.set(bucket[j].uid, 'possible');
                    unionContacts(bucket[i].uid, bucket[j].uid);
                }
            }
        }
    }
    for (const [uid, tier] of contactTier) {
        const c = contactByUid.get(uid);
        const name = String(c?.CompanyName || `${c?.FirstName ?? ''} ${c?.LastName ?? ''}`.trim());
        const addresses = Array.isArray(c?.Addresses) ? c.Addresses : [];
        const email = String(addresses[0]?.Email ?? '');
        const detail = tier === 'exact'
            ? (email ? `Same email/phone as another contact (${email})` : 'Same phone as another contact')
            : tier === 'likely'
                ? 'Same business name as another contact record'
                : 'Similar name to another contact record';
        detailRows.push({ category: 'Contact', label: `Contact · ${name}`, detail, tier, amount: '' });
    }
    const matchDocs = (recs, categoryLabel) => {
        const tier = new Map();
        // Pass 1a — same raw contact + same non-blank document number => exact.
        const byContactNum = new Map();
        for (const r of recs) {
            if (!r.docNum)
                continue;
            const key = `${r.contactId}|${r.docNum}`;
            (byContactNum.get(key) ?? byContactNum.set(key, []).get(key)).push(r);
        }
        for (const [, group] of byContactNum)
            if (group.length > 1)
                group.forEach((r) => tier.set(r.id, 'exact'));
        // Pass 1b — same raw contact + same total: 0-2 days apart => likely,
        // 3-7 days apart => possible (mirrors the reference mockup's own
        // "same amount, N days apart" wording for the possible tier).
        const byContactTotal = new Map();
        for (const r of recs) {
            const key = `${r.contactId}|${r.total ?? ''}`;
            (byContactTotal.get(key) ?? byContactTotal.set(key, []).get(key)).push(r);
        }
        for (const [, group] of byContactTotal) {
            if (group.length < 2)
                continue;
            for (let i = 0; i < group.length; i++) {
                for (let j = i + 1; j < group.length; j++) {
                    const a = group[i], b = group[j];
                    if (tier.get(a.id) === 'exact' && tier.get(b.id) === 'exact')
                        continue;
                    const days = daysBetween(a.date, b.date);
                    if (days <= 2) {
                        if (!tier.has(a.id))
                            tier.set(a.id, 'likely');
                        if (!tier.has(b.id))
                            tier.set(b.id, 'likely');
                    }
                    else if (days <= 7) {
                        if (!tier.has(a.id))
                            tier.set(a.id, 'possible');
                        if (!tier.has(b.id))
                            tier.set(b.id, 'possible');
                    }
                }
            }
        }
        // Pass 2 — cross the contact boundary via canonicalContact, but ONLY
        // for docs not already tagged, and NEVER above 'likely': a match that
        // only exists because two Contact records are themselves flagged as
        // duplicates is one hop weaker than a same-record match.
        const byCanonTotal = new Map();
        for (const r of recs) {
            const key = `${canonicalContact(r.contactId)}|${r.total ?? ''}`;
            (byCanonTotal.get(key) ?? byCanonTotal.set(key, []).get(key)).push(r);
        }
        for (const [, group] of byCanonTotal) {
            const exactRecs = group.filter((r) => tier.get(r.id) === 'exact');
            if (exactRecs.length === 0)
                continue;
            for (const r of group) {
                if (tier.has(r.id))
                    continue;
                const dayKey = dayKeyOf(r.date);
                if (dayKey != null && exactRecs.some((e) => e.contactId !== r.contactId && dayKeyOf(e.date) === dayKey)) {
                    tier.set(r.id, 'likely');
                }
            }
        }
        return tier;
    };
    const billRecs = bills.map((b) => {
        const supplier = b.Supplier;
        return {
            id: String(b.UID ?? ''),
            contactId: String(supplier?.UID ?? ''),
            contactName: String(supplier?.Name ?? 'Unknown supplier'),
            docNum: String(b.SupplierInvoiceNumber ?? '').trim(),
            total: b.TotalAmount,
            date: b.Date,
        };
    });
    const billTier = matchDocs(billRecs, 'Bill');
    const billById = new Map(billRecs.map((r) => [r.id, r]));
    for (const [id, tier] of billTier) {
        const r = billById.get(id);
        const b = bills.find((x) => String(x.UID ?? '') === id);
        const siblings = billRecs.filter((o) => o.id !== id && o.contactId === r.contactId && o.docNum === r.docNum && r.docNum);
        const detail = tier === 'exact'
            ? `Same supplier inv # ${r.docNum} on ${siblings.length + 1} bills · ${fmtDate(r.date)}`
            : `Same supplier & amount, ${daysApartPhrase(Math.round(Math.min(...billRecs
                .filter((o) => o.id !== id && o.contactId === r.contactId && String(o.total) === String(r.total))
                .map((o) => daysBetween(o.date, r.date)))))}`;
        detailRows.push({ category: 'Bill', label: `Bill · ${r.contactName}`, detail, tier, amount: fmtAmt(b.TotalAmount) });
    }
    const invRecs = invoices.map((inv) => {
        const customer = inv.Customer;
        return {
            id: String(inv.UID ?? ''),
            contactId: String(customer?.UID ?? ''),
            contactName: String(customer?.Name ?? 'Unknown customer'),
            docNum: String(inv.CustomerPurchaseOrderNumber ?? '').trim(),
            total: inv.TotalAmount,
            date: inv.Date,
        };
    });
    const invTier = matchDocs(invRecs, 'Invoice');
    const invById = new Map(invRecs.map((r) => [r.id, r]));
    for (const [id, tier] of invTier) {
        const r = invById.get(id);
        const inv = invoices.find((x) => String(x.UID ?? '') === id);
        const siblings = invRecs.filter((o) => o.id !== id && o.contactId === r.contactId && o.docNum === r.docNum && r.docNum);
        const detail = tier === 'exact'
            ? (r.docNum
                ? `Same customer PO # ${r.docNum} on ${siblings.length + 1} invoices · ${fmtDate(r.date)}`
                : `Same customer & amount, same day · ${fmtDate(r.date)}`)
            : `Same customer & amount, ${daysApartPhrase(Math.round(Math.min(...invRecs
                .filter((o) => o.id !== id && o.contactId === r.contactId && String(o.total) === String(r.total))
                .map((o) => daysBetween(o.date, r.date)))))}`;
        detailRows.push({ category: 'Invoice', label: `Invoice · ${r.contactName}`, detail, tier, amount: fmtAmt(inv.TotalAmount) });
    }
    detailRows.sort((a, b) => {
        const order = { exact: 0, likely: 1, possible: 2 };
        return order[a.tier] - order[b.tier];
    });
    const tierCount = (cat) => {
        const rows = cat ? detailRows.filter((r) => r.category === cat) : detailRows;
        return {
            exact: rows.filter((r) => r.tier === 'exact').length,
            likely: rows.filter((r) => r.tier === 'likely').length,
            possible: rows.filter((r) => r.tier === 'possible').length,
            total: rows.length,
        };
    };
    const shaped = detailRows.map(({ category, label, detail, tier, amount }) => ({
        category,
        label,
        detail,
        tier: tier.toUpperCase(),
        tierTone: tier === 'exact' ? 'warning' : tier === 'likely' ? 'info' : 'muted',
        amount,
    }));
    const filtered = filter ? shaped.filter((r) => r.category === filter) : shaped;
    return {
        totalOpen: detailRows.length,
        filter,
        filteredTotal: filtered.length,
        filterCounts: {
            all: detailRows.length,
            bills: tierCount('Bill').total,
            invoices: tierCount('Invoice').total,
            contacts: tierCount('Contact').total,
        },
        previewRows: filtered.slice(0, 3),
        previewCount: Math.min(3, filtered.length),
        detailRows: filtered,
        lastScanAt: new Date().toISOString(),
    };
};
// ── analyze_exclusion_check ──────────────────────────────────────────
// Rolls up three independently-verified real MYOB exclusion signals into
// one summary card:
//  - Supplier Exclusion Screen: suppliers marked Inactive that still have
//    at least one Bill against them (same signal as the standalone
//    "MYOB — Exclusion Check (Suppliers)" tile's analyze_supplier_exclusions).
//  - Inactive Contact Activity: CUSTOMERS marked Inactive that still have
//    at least one Invoice against them. Deliberately scoped to customers
//    only (not suppliers) so this never double-counts the same record as
//    Supplier Exclusion Screen above — an inactive supplier with a bill is
//    always reported there, never here.
//  - Excluded Account Postings: accounts named Suspense/Non-deductible, or
//    themselves marked Inactive, carrying a real non-zero CurrentBalance.
// "GST Exclusion Mismatch" from the original 4-check reference is NOT
// buildable: confirmed via live testing that this MCP server's get_invoice
// and get_bill tools return no Lines/LineItems field at all (not just the
// list endpoints — every single-record fetch was checked too), even though
// the connector's own README documents them as returning full line-item
// detail. A real MCP-server-side gap, not a widget-side limitation —
// intentionally omitted rather than shown with a placeholder number.
// `filter` ('' | 'Supplier' | 'Customer' | 'Account') narrows detailRows to
// one check — set when a summary row is clicked, echoed back unchanged so
// the spec can tell which row opened the detail view from the same state
// write that applied it. `showAll` is similarly echoed back (not derived)
// so a background data refresh (a fresh watch firing after list_bills/
// list_invoices/list_accounts re-arrive) doesn't silently close an
// already-open detail view — both must be read back out of current state
// and passed in again on every recompute, same pattern as
// analyze_myob_duplicates' `filter`.
// Args: { contacts?: Contact[], bills?: Bill[], invoices?: Invoice[], accounts?: Account[], filter?: string, showAll?: boolean }
const analyze_exclusion_check = (args) => {
    const contacts = Array.isArray(args.contacts) ? args.contacts : [];
    const bills = Array.isArray(args.bills) ? args.bills : [];
    const invoices = Array.isArray(args.invoices) ? args.invoices : [];
    const accounts = Array.isArray(args.accounts) ? args.accounts : [];
    const filter = ['Supplier', 'Customer', 'Account'].includes(String(args.filter)) ? String(args.filter) : '';
    const showAll = Boolean(args.showAll);
    const fmtAmt = (n) => {
        const v = Number(n);
        if (!Number.isFinite(v))
            return '';
        return 'A$' + new Intl.NumberFormat('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
    };
    // Supplier Exclusion Screen — inactive suppliers that still have at
    // least one bill against them (a blocked/retired vendor someone is
    // still paying).
    const inactiveSupplierUids = new Set(contacts.filter((c) => c.Type === 'Supplier' && c.IsActive === false).map((c) => String(c.UID ?? '')));
    const billsBySupplierForExc = new Map();
    for (const b of bills) {
        const supplier = b.Supplier;
        const uid = String(supplier?.UID ?? '');
        if (!inactiveSupplierUids.has(uid))
            continue;
        (billsBySupplierForExc.get(uid) ?? billsBySupplierForExc.set(uid, []).get(uid)).push(b);
    }
    const supplierDetailRows = contacts
        .filter((c) => billsBySupplierForExc.has(String(c.UID ?? '')))
        .map((c) => {
        const uidBills = billsBySupplierForExc.get(String(c.UID ?? '')) ?? [];
        const total = uidBills.reduce((s, b) => s + (Number(b.TotalAmount) || 0), 0);
        const billWord = `${uidBills.length} bill${uidBills.length !== 1 ? 's' : ''}`;
        return {
            category: 'Supplier',
            label: String(c.CompanyName ?? ''),
            detail: `Inactive supplier — ${billWord} still outstanding`,
            amount: fmtAmt(total),
        };
    });
    // Inactive Contact Activity — customers marked Inactive that still have
    // at least one invoice against them.
    const inactiveCustomerUids = new Set(contacts.filter((c) => c.Type === 'Customer' && c.IsActive === false).map((c) => String(c.UID ?? '')));
    const invoicesByCustomerForExc = new Map();
    for (const i of invoices) {
        const customer = i.Customer;
        const uid = String(customer?.UID ?? '');
        if (!inactiveCustomerUids.has(uid))
            continue;
        (invoicesByCustomerForExc.get(uid) ?? invoicesByCustomerForExc.set(uid, []).get(uid)).push(i);
    }
    const customerDetailRows = contacts
        .filter((c) => invoicesByCustomerForExc.has(String(c.UID ?? '')))
        .map((c) => {
        const uidInvoices = invoicesByCustomerForExc.get(String(c.UID ?? '')) ?? [];
        const total = uidInvoices.reduce((s, i) => s + (Number(i.TotalAmount) || 0), 0);
        const invWord = `${uidInvoices.length} invoice${uidInvoices.length !== 1 ? 's' : ''}`;
        return {
            category: 'Customer',
            label: String(c.CompanyName ?? ''),
            detail: `Inactive customer — ${invWord} still outstanding`,
            amount: fmtAmt(total),
        };
    });
    // Excluded Account Postings — accounts whose balance sits outside normal
    // P&L/balance-sheet reporting: a Suspense/clearing account, an account
    // explicitly marked non-deductible for tax purposes, or any account
    // that's been made Inactive but still carries a live balance.
    const reasonFor = (a) => {
        const name = String(a.Name ?? '');
        if (/suspense/i.test(name))
            return 'Suspense account — balance not yet cleared to a real account';
        if (/non.?deductible/i.test(name))
            return 'Marked non-deductible for tax purposes';
        if (a.IsActive === false)
            return 'Inactive account still carrying a live balance';
        return String(a.Classification ?? '');
    };
    const flaggedAccounts = accounts.filter((a) => {
        const name = String(a.Name ?? '');
        const isSuspenseOrNonDeductible = /suspense|non.?deductible/i.test(name);
        const isInactive = a.IsActive === false;
        return (isSuspenseOrNonDeductible || isInactive) && Math.abs(Number(a.CurrentBalance) || 0) > 0;
    });
    const accountDetailRows = flaggedAccounts.map((a) => ({
        category: 'Account',
        label: String(a.Name ?? ''),
        detail: reasonFor(a),
        amount: fmtAmt(a.CurrentBalance),
    }));
    const rows = [
        {
            category: 'Supplier',
            label: 'Supplier Exclusion Screen',
            description: 'Inactive suppliers with bills still outstanding',
            count: supplierDetailRows.length,
            tone: 'destructive',
        },
        {
            category: 'Customer',
            label: 'Inactive Contact Activity',
            description: 'Inactive customers with invoices still outstanding',
            count: customerDetailRows.length,
            tone: 'warning',
        },
        {
            category: 'Account',
            label: 'Excluded Account Postings',
            description: 'Suspense, non-deductible, or inactive account balances',
            count: accountDetailRows.length,
            tone: 'success',
        },
    ];
    const allDetailRows = [...supplierDetailRows, ...customerDetailRows, ...accountDetailRows];
    const filterLabel = filter ? (rows.find((r) => r.category === filter)?.label ?? 'All flagged items') : 'All flagged items';
    return {
        totalCount: rows.reduce((s, r) => s + r.count, 0),
        checksCount: rows.length,
        rows,
        filter,
        showAll,
        filterLabel,
        detailRows: filter ? allDetailRows.filter((r) => r.category === filter) : allDetailRows,
    };
};
// ── duplicate_check_status_label ────────────────────────────────────
// "Review" when any Critical-tier duplicates exist, "Clear" otherwise.
// Args: { value: number } — critical duplicate count
const duplicate_check_status_label = (args) => (Number(args.value) || 0) > 0 ? 'Review' : 'Clear';
// ── duplicate_check_status_tone ─────────────────────────────────────
// "warning" when any Critical-tier duplicates exist, "success" otherwise.
// Args: { value: number } — critical duplicate count
const duplicate_check_status_tone = (args) => (Number(args.value) || 0) > 0 ? 'warning' : 'success';
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
        flatten_overdue_invoices,
        flatten_invoices,
        flatten_bills,
        is_overdue,
        monthly_totals,
        txn_count,
        txn_amount,
        txn_truncated,
        net_monthly,
        cash_received,
        bool_not,
        three_month_window,
        analyze_duplicate_contacts,
        analyze_myob_duplicates,
        analyze_exclusion_check,
        duplicate_check_status_label,
        duplicate_check_status_tone,
        paginate,
    },
};
export default elements;
