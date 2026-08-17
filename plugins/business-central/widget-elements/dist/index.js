const ARRAY_KEYS = ['value', 'items', 'records', 'rows', 'results', 'data'];
function parseRows(input, depth = 0) {
    if (input == null || depth > 4)
        return [];
    if (Array.isArray(input)) {
        return input.filter((r) => r != null && typeof r === 'object');
    }
    if (typeof input === 'string') {
        const s = input.trim();
        if (!s.startsWith('{') && !s.startsWith('['))
            return [];
        try {
            return parseRows(JSON.parse(s), depth + 1);
        }
        catch {
            return [];
        }
    }
    if (typeof input === 'object') {
        const obj = input;
        // MCP content envelope: { content: [{ type: 'text', text: '...' }] }
        if (Array.isArray(obj.content)) {
            for (const part of obj.content) {
                if (part && typeof part === 'object' && typeof part.text === 'string') {
                    const parsed = parseRows(part.text, depth + 1);
                    if (parsed.length > 0)
                        return parsed;
                }
            }
        }
        for (const key of ARRAY_KEYS) {
            if (key in obj) {
                const parsed = parseRows(obj[key], depth + 1);
                if (parsed.length > 0)
                    return parsed;
            }
        }
    }
    return [];
}
function toNumber(v) {
    if (typeof v === 'number')
        return Number.isFinite(v) ? v : 0;
    if (typeof v === 'string' && v.trim() !== '') {
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    }
    return 0;
}
// Currency-symbol prefix per TILE-DISPLAY-STANDARDS §2 (`A$x,xxx.xx`).
// BC reports blank `currencyCode` for local-currency rows, so callers pass
// an explicit fallback (tiles default to AUD — documented in the README).
const CURRENCY_SYMBOLS = {
    AUD: 'A$',
    USD: '$',
    NZD: 'NZ$',
    GBP: '£',
    EUR: '€',
    CAD: 'C$',
    SGD: 'S$',
    JPY: '¥',
};
function money(value, rowCurrency, fallback) {
    const n = toNumber(value);
    const code = (typeof rowCurrency === 'string' && rowCurrency.trim()) ||
        (typeof fallback === 'string' && fallback.trim()) ||
        'AUD';
    const abs = Math.abs(n).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    const symbol = CURRENCY_SYMBOLS[code.toUpperCase()];
    const body = symbol ? `${symbol}${abs}` : `${code.toUpperCase()} ${abs}`;
    return n < 0 ? `-${body}` : body;
}
// "2026-08-05" / ISO datetime → local-midnight Date (date part only, so a
// due date never shifts across the viewer's timezone). Null when absent.
function parseDate(v) {
    if (typeof v !== 'string' || v.length < 8)
        return null;
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m)
        return null;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return Number.isNaN(d.getTime()) ? null : d;
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// TILE-DISPLAY-STANDARDS §1 default: `dd-Mmm-yy`, e.g. `05-Aug-26`.
function ddMmmYy(d) {
    const day = String(d.getDate()).padStart(2, '0');
    return `${day}-${MONTHS[d.getMonth()]}-${String(d.getFullYear() % 100).padStart(2, '0')}`;
}
function daysFromToday(d) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}
// ── rows ─────────────────────────────────────────────────────────────
// Normalize any BC MCP tool result into an array of row objects.
// Args: { value: unknown }
const rows = (args) => parseRows(args.value);
// ── ar_view ──────────────────────────────────────────────────────────
// Shape agedAccountsReceivables rows (page 30031) into one view object:
//   { hasData, totalDisplay, currentDisplay, overdueDisplay, overduePct,
//     buckets: [{ key, label, display, tone }], top: [...] }
// Bucket tones are a deliberate severity gradient (see README):
// current=muted, 1–30=info, 31–60=warning, 61+=destructive.
// Args: { value: unknown, currency?: string, topLimit?: number }
const ar_view = (args) => {
    const data = parseRows(args.value);
    const currency = args.currency;
    const topLimit = typeof args.topLimit === 'number' ? args.topLimit : 5;
    let total = 0;
    let current = 0;
    const periods = [0, 0, 0];
    const perCustomer = [];
    for (const r of data) {
        const balance = toNumber(r.balanceDue);
        const before = toNumber(r.currentAmount);
        const p = [toNumber(r.period1Amount), toNumber(r.period2Amount), toNumber(r.period3Amount)];
        total += balance;
        current += before;
        periods[0] += p[0];
        periods[1] += p[1];
        periods[2] += p[2];
        const overdue = p[0] + p[1] + p[2];
        if (overdue > 0) {
            perCustomer.push({
                name: String(r.name ?? r.customerNumber ?? '—'),
                number: String(r.customerNumber ?? r.customerId ?? ''),
                overdue,
                balance,
                code: r.currencyCode,
            });
        }
    }
    const first = data[0] ?? {};
    const overdueTotal = periods[0] + periods[1] + periods[2];
    const labels = [
        String(first.period1Label ?? '') || '1–30 days',
        String(first.period2Label ?? '') || '31–60 days',
        String(first.period3Label ?? '') || '61+ days',
    ];
    const tones = ['info', 'warning', 'destructive'];
    perCustomer.sort((a, b) => b.overdue - a.overdue);
    return {
        hasData: data.length > 0,
        totalDisplay: money(total, first.currencyCode, currency),
        currentDisplay: money(current, first.currencyCode, currency),
        overdueDisplay: money(overdueTotal, first.currencyCode, currency),
        overduePct: total > 0 ? `${Math.round((overdueTotal / total) * 100)}%` : '0%',
        buckets: [
            { key: 'current', label: 'Current', display: money(current, first.currencyCode, currency), tone: 'muted' },
            ...periods.map((amount, i) => ({
                key: `period${i + 1}`,
                label: labels[i],
                display: money(amount, first.currencyCode, currency),
                tone: tones[i],
            })),
        ],
        top: perCustomer.slice(0, topLimit).map((c) => ({
            name: c.name,
            number: c.number,
            overdueDisplay: money(c.overdue, c.code, currency),
            balanceDisplay: money(c.balance, c.code, currency),
        })),
    };
};
// ── invoices_view ────────────────────────────────────────────────────
// Shape salesInvoices rows (page 30012) into a view of posted, unpaid
// (`Open`) invoices sorted by due date. Overdue escalation follows the
// WorkQ model (TILE-DISPLAY-STANDARDS §7): muted before due, warning on
// the due date, destructive from the day after.
// Args: { value: unknown, currency?: string, limit?: number }
const invoices_view = (args) => {
    const data = parseRows(args.value);
    const currency = args.currency;
    const limit = typeof args.limit === 'number' ? args.limit : 8;
    const open = data.filter((r) => String(r.status ?? '').toLowerCase() === 'open');
    const shaped = open.map((r) => {
        const due = parseDate(r.dueDate);
        const amount = 'remainingAmount' in r ? r.remainingAmount : r.totalAmountIncludingTax;
        let dueLabel = 'No Due Date';
        let dueTone = 'muted';
        let dueSort = Number.MAX_SAFE_INTEGER;
        if (due) {
            const days = daysFromToday(due);
            dueSort = due.getTime();
            if (days > 0) {
                dueLabel = `Due ${ddMmmYy(due)}`;
                dueTone = 'muted';
            }
            else if (days === 0) {
                dueLabel = 'Due Today';
                dueTone = 'warning';
            }
            else {
                dueLabel = `Overdue ${-days}d`;
                dueTone = 'destructive';
            }
        }
        return {
            number: String(r.number ?? ''),
            customerName: String(r.customerName ?? r.billToName ?? '—'),
            invoiceDate: (() => {
                const d = parseDate(r.invoiceDate);
                return d ? ddMmmYy(d) : '';
            })(),
            amountDisplay: money(amount, r.currencyCode, currency),
            amount: toNumber(amount),
            dueLabel,
            dueTone,
            dueSort,
        };
    });
    shaped.sort((a, b) => a.dueSort - b.dueSort);
    const totalOutstanding = shaped.reduce((sum, r) => sum + r.amount, 0);
    const firstCode = open[0]?.currencyCode;
    return {
        hasData: data.length > 0,
        count: shaped.length,
        totalDisplay: money(totalOutstanding, firstCode, currency),
        items: shaped.slice(0, limit),
    };
};
// ── stock_view ───────────────────────────────────────────────────────
// Shape items rows (page 30008) into the lowest-stock inventory items.
// Only `Inventory`-type, unblocked items count — Service / Non-Inventory
// items have no meaningful quantity on hand. Tones: destructive when out
// of stock (≤ 0), warning below `threshold`, muted otherwise.
// Args: { value: unknown, currency?: string, threshold?: number, limit?: number }
const stock_view = (args) => {
    const data = parseRows(args.value);
    const currency = args.currency;
    const threshold = typeof args.threshold === 'number' ? args.threshold : 10;
    const limit = typeof args.limit === 'number' ? args.limit : 8;
    const stocked = data.filter((r) => {
        const type = String(r.type ?? '').toLowerCase();
        if (type === 'service' || type.startsWith('non'))
            return false;
        return !r.blocked;
    });
    const shaped = stocked.map((r) => {
        const qty = toNumber(r.inventory);
        const uom = String(r.baseUnitOfMeasureCode ?? '').trim();
        let qtyLabel;
        let qtyTone;
        if (qty <= 0) {
            qtyLabel = 'Out of Stock';
            qtyTone = 'destructive';
        }
        else {
            qtyLabel = uom ? `${qty} ${uom}` : String(qty);
            qtyTone = qty < threshold ? 'warning' : 'muted';
        }
        return {
            number: String(r.number ?? ''),
            displayName: String(r.displayName ?? r.number ?? '—'),
            qty,
            qtyLabel,
            qtyTone,
            priceDisplay: money(r.unitPrice, undefined, currency),
        };
    });
    shaped.sort((a, b) => a.qty - b.qty);
    return {
        hasData: data.length > 0,
        lowCount: shaped.filter((r) => r.qty < threshold).length,
        items: shaped.slice(0, limit),
    };
};
const elements = {
    slug: 'business-central',
    functions: {
        rows,
        ar_view,
        invoices_view,
        stock_view,
    },
};
export default elements;
