/**
 * stripe — widget-elements module
 * ──────────────────────────────────────────────────────────────────────────
 * Connector-specific `$computed` helpers contributed to the host's
 * widgets-system at runtime. The host prepends the slug `stripe_` to every
 * name in `functions`, so the spec-side reference is e.g.
 * `stripe_format_currency`.
 *
 * No external imports — only the local types contract.
 */
// ── format_currency ───────────────────────────────────────────────────────
// Stripe stores amounts in the smallest currency unit (cents for USD/AUD/EUR,
// pence for GBP, etc.). This divides by 100 and formats as a human-readable
// currency string.
//
// Args: { amount: number, currency: string }
// Returns: string e.g. "$1,234.56"
const format_currency = (args) => {
    const raw = args.amount;
    const currency = String(args.currency ?? 'usd').toUpperCase();
    // Zero-decimal currencies (Stripe's official list).
    const zeroDecimal = new Set([
        'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG',
        'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
    ]);
    const amount = typeof raw === 'number' ? raw : Number(raw ?? 0);
    if (!Number.isFinite(amount))
        return '';
    const value = zeroDecimal.has(currency) ? amount : amount / 100;
    try {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency,
            minimumFractionDigits: zeroDecimal.has(currency) ? 0 : 2,
            maximumFractionDigits: zeroDecimal.has(currency) ? 0 : 2,
        }).format(value);
    }
    catch {
        // Fallback for unknown currency codes
        const formatted = value.toFixed(zeroDecimal.has(currency) ? 0 : 2);
        return `${currency} ${formatted}`;
    }
};
// ── subscription_status_tone ──────────────────────────────────────────────
// Map Stripe subscription status strings to semantic tone palette.
// Args: { status: string }
// Returns: 'success' | 'info' | 'warning' | 'destructive' | 'muted'
const subscription_status_tone = (args) => {
    const s = String(args.status ?? '').toLowerCase();
    if (s === 'active')
        return 'success';
    if (s === 'trialing')
        return 'info';
    if (s === 'past_due')
        return 'warning';
    if (s === 'canceled' || s === 'unpaid')
        return 'destructive';
    // incomplete, incomplete_expired, paused, etc.
    return 'muted';
};
// ── invoice_status_tone ───────────────────────────────────────────────────
// Map Stripe invoice status strings to semantic tone palette.
// Args: { status: string }
// Returns: 'success' | 'info' | 'warning' | 'destructive' | 'muted'
const invoice_status_tone = (args) => {
    const s = String(args.status ?? '').toLowerCase();
    if (s === 'paid')
        return 'success';
    if (s === 'open')
        return 'warning';
    if (s === 'draft')
        return 'muted';
    if (s === 'void')
        return 'muted';
    if (s === 'uncollectible')
        return 'destructive';
    return 'muted';
};
// ── payment_intent_status_tone ────────────────────────────────────────────
// Map Stripe PaymentIntent status strings to semantic tone palette.
// Args: { status: string }
// Returns: 'success' | 'info' | 'warning' | 'destructive' | 'muted'
const payment_intent_status_tone = (args) => {
    const s = String(args.status ?? '').toLowerCase();
    if (s === 'succeeded')
        return 'success';
    if (s === 'processing')
        return 'info';
    if (s === 'requires_action' || s === 'requires_confirmation')
        return 'warning';
    if (s === 'requires_payment_method')
        return 'warning';
    if (s === 'canceled')
        return 'destructive';
    // requires_capture, etc.
    return 'muted';
};
// ── sort_by_key ───────────────────────────────────────────────────────────
// Sort an array of objects by a composite key string "field|asc" or "field|desc".
// Compares numerically when both values are numbers, otherwise lexically.
// Args: { value: unknown[], key: string }
// Returns: sorted array
const sort_by_key = (args) => {
    const arr = Array.isArray(args.value) ? [...args.value] : [];
    const keyStr = String(args.key ?? 'name|asc');
    const [field, dir] = keyStr.split('|');
    return arr.sort((a, b) => {
        const av = a[field] ?? '';
        const bv = b[field] ?? '';
        const an = Number(av);
        const bn = Number(bv);
        const cmp = !isNaN(an) && !isNaN(bn) ? an - bn : String(av).localeCompare(String(bv));
        return dir === 'desc' ? -cmp : cmp;
    });
};
// ── cycle_sort ────────────────────────────────────────────────────────────
// Toggle sort direction on the current field (asc ↔ desc).
// Args: { current: string }
const cycle_sort = (args) => {
    const current = String(args.current ?? '');
    const [field, dir] = current.split('|');
    return `${field}|${dir === 'asc' ? 'desc' : 'asc'}`;
};
// ── set_sort_field ────────────────────────────────────────────────────────
// Set the active sort field. If already sorting by that field, toggles
// direction (asc ↔ desc). Otherwise resets to field|asc.
// Args: { current: string, field: string }
const set_sort_field = (args) => {
    const current = String(args.current ?? '');
    const field = String(args.field ?? '');
    const [currentField, currentDir] = current.split('|');
    if (currentField === field)
        return `${field}|${currentDir === 'asc' ? 'desc' : 'asc'}`;
    return `${field}|asc`;
};
// ── format_stripe_date ────────────────────────────────────────────────────
// Convert a Unix timestamp (seconds since epoch, as returned by Stripe) to a
// human-readable date string.
//
// Args: { value: number }
// Returns: string e.g. "15 Jun 2026"
const format_stripe_date = (args) => {
    const raw = args.value;
    if (raw == null || raw === '')
        return '';
    const ts = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(ts) || ts === 0)
        return '';
    // Stripe timestamps are seconds; JS Date expects milliseconds.
    const d = new Date(ts * 1000);
    return d.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
};
// ── format_stripe_date_dmy ───────────────────────────────────────────────────
// Convert a Unix timestamp to dd-mmm-yyyy format (e.g. "03-Sep-2026").
// Args: { value: number }
// Returns: string e.g. "03-Sep-2026"
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const format_stripe_date_dmy = (args) => {
    const raw = args.value;
    if (raw == null || raw === '')
        return '';
    const ts = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(ts) || ts === 0)
        return '';
    const d = new Date(ts * 1000);
    return `${String(d.getDate()).padStart(2, '0')}-${MONTH_ABBR[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
};
// ── format_stripe_date_short ─────────────────────────────────────────────────
// Convert a Unix timestamp to a short date string without the year.
// Args: { value: number }
// Returns: string e.g. "29 Aug"
const format_stripe_date_short = (args) => {
    const raw = args.value;
    if (raw == null || raw === '')
        return '';
    const ts = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(ts) || ts === 0)
        return '';
    const d = new Date(ts * 1000);
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};
// ── build_customer_url ────────────────────────────────────────────────────────
// Build a Stripe Dashboard URL for a customer. Uses platform→connected URL when
// both account IDs are present; falls back to simple URL otherwise.
// Args: { customer_id: string, livemode: boolean, platform_id: string, connected_id: string }
// Returns: string URL
const build_customer_url = (args) => {
    const customerId = String(args.customer_id ?? '');
    const livemode = Boolean(args.livemode);
    const platformId = String(args.platform_id ?? '');
    const connectedId = String(args.connected_id ?? '');
    const mode = livemode ? '' : '/test';
    if (platformId && connectedId) {
        return `https://dashboard.stripe.com/${platformId}${mode}/connect/accounts/${connectedId}/customers/${customerId}`;
    }
    return `https://dashboard.stripe.com${mode}/customers/${customerId}`;
};
// ── flatten_invoices ──────────────────────────────────────────────────────────
// Sort and pre-format raw Stripe invoice objects into display-ready row data.
// Args: { value: raw invoice array, key: sort key e.g. "customer_name|asc" }
// Returns: display row array
function formatInvoiceStatusLabel(status) {
    switch (status.toLowerCase()) {
        case 'paid': return 'Paid';
        case 'open': return 'Open';
        case 'draft': return 'Draft';
        case 'void': return 'Void';
        case 'uncollectible': return 'Uncollectible';
        default: return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
    }
}
const flatten_invoices = (args) => {
    const raw = Array.isArray(args.value) ? args.value : [];
    const keyStr = String(args.key ?? 'customer_name|asc');
    const [field, dir] = keyStr.split('|');
    const rows = raw.map(item => {
        const status = String(item.status ?? '');
        const amountCents = typeof item.amount_due === 'number' ? item.amount_due : Number(item.amount_due ?? 0);
        const dueDateTs = typeof item.due_date === 'number' ? item.due_date : Number(item.due_date ?? 0);
        return {
            id: String(item.id ?? ''),
            customer_name: String(item.customer_name ?? ''),
            number: String(item.number ?? ''),
            amount: format_currency({ amount: item.amount_due, currency: 'aud' }),
            amount_cents: amountCents,
            due_date: format_stripe_date_dmy({ value: item.due_date }),
            due_date_ts: dueDateTs,
            status,
            status_label: formatInvoiceStatusLabel(status),
            hosted_invoice_url: String(item.hosted_invoice_url ?? ''),
        };
    });
    rows.sort((a, b) => {
        const av = a[field] ?? '';
        const bv = b[field] ?? '';
        const an = Number(av);
        const bn = Number(bv);
        const cmp = !isNaN(an) && !isNaN(bn) ? an - bn : String(av).localeCompare(String(bv));
        return dir === 'desc' ? -cmp : cmp;
    });
    return rows;
};
// ── to_monthly_cents ─────────────────────────────────────────────────────────
// Internal helper: convert a single subscription line-item to its monthly
// equivalent in cents, accounting for interval and quantity.
function toMonthlyCents(item) {
    const price = item.price ?? {};
    const unitAmount = typeof price.unit_amount === 'number' ? price.unit_amount : 0;
    const quantity = typeof item.quantity === 'number' ? item.quantity : 1;
    const recurring = price.recurring ?? {};
    const interval = String(recurring.interval ?? 'month');
    const intervalCount = typeof recurring.interval_count === 'number' ? recurring.interval_count : 1;
    switch (interval) {
        case 'year': return (unitAmount * quantity) / (12 * intervalCount);
        case 'week': return (unitAmount * quantity * 52) / (12 * intervalCount);
        case 'day': return (unitAmount * quantity * 365) / (12 * intervalCount);
        default: return (unitAmount * quantity) / intervalCount; // month
    }
}
// ── calc_mrr ──────────────────────────────────────────────────────────────────
// Sum normalized monthly revenue across all active subscriptions and return a
// formatted AUD currency string.
// Args: { value: raw subscription array (expanded items + price) }
// Returns: string e.g. "A$198.00"
const calc_mrr = (args) => {
    const subs = Array.isArray(args.value) ? args.value : [];
    let totalCents = 0;
    for (const sub of subs) {
        const items = sub.items?.data ?? [];
        for (const item of items) {
            totalCents += toMonthlyCents(item);
        }
    }
    return format_currency({ amount: totalCents, currency: 'aud' });
};
// ── flatten_subscriptions ─────────────────────────────────────────────────────
// Pre-process raw expanded Stripe subscription objects into display-ready rows.
// Resolves expanded customer/product objects to plain strings.
// Args: { value: raw subscription array, key: sort key e.g. "customer_name|asc" }
// Returns: display row array
function formatSubscriptionStatusLabel(status) {
    switch (status.toLowerCase()) {
        case 'active': return 'Active';
        case 'trialing': return 'Trialing';
        case 'past_due': return 'Past due';
        case 'canceled': return 'Canceled';
        case 'unpaid': return 'Unpaid';
        case 'incomplete': return 'Incomplete';
        case 'incomplete_expired': return 'Expired';
        case 'paused': return 'Paused';
        default: return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
    }
}
const flatten_subscriptions = (args) => {
    const subs = Array.isArray(args.value) ? args.value : [];
    const keyStr = String(args.key ?? 'customer_name|asc');
    const [field, dir] = keyStr.split('|');
    const rows = subs.map(sub => {
        const customer = sub.customer;
        let customerName = '';
        let customerEmail = '';
        if (customer && typeof customer === 'object') {
            const c = customer;
            customerName = String(c.name ?? c.email ?? '');
            customerEmail = String(c.email ?? '');
        }
        else {
            customerName = String(customer ?? '');
        }
        const items = sub.items?.data ?? [];
        let planName = '';
        if (items.length > 0) {
            const price = items[0].price ?? {};
            const product = price.product ?? {};
            planName = String(product.name ?? price.nickname ?? price.id ?? '');
        }
        let subCents = 0;
        for (const item of items) {
            subCents += toMonthlyCents(item);
        }
        const status = String(sub.status ?? '');
        return {
            id: String(sub.id ?? ''),
            customer_name: customerName,
            customer_email: customerEmail,
            plan_name: planName,
            amount: format_currency({ amount: subCents, currency: 'aud' }),
            amount_cents: subCents,
            current_period_end: typeof sub.current_period_end === 'number' ? sub.current_period_end : 0,
            status,
            status_label: formatSubscriptionStatusLabel(status),
        };
    });
    rows.sort((a, b) => {
        const av = a[field] ?? '';
        const bv = b[field] ?? '';
        const an = Number(av);
        const bn = Number(bv);
        const cmp = !isNaN(an) && !isNaN(bn) ? an - bn : String(av).localeCompare(String(bv));
        return dir === 'desc' ? -cmp : cmp;
    });
    return rows;
};
// ── flatten_payments ──────────────────────────────────────────────────────────
// Pre-process expanded Stripe PaymentIntent objects into display-ready rows.
// Resolves expanded customer/payment_method to plain strings.
// Args: { value: raw payment intent array, key: sort key e.g. "created|desc" }
// Returns: display row array
function formatPaymentStatusLabel(status) {
    switch (status.toLowerCase()) {
        case 'succeeded': return 'Succeeded';
        case 'processing': return 'Processing';
        case 'requires_action': return 'Action required';
        case 'requires_confirmation': return 'Pending';
        case 'requires_payment_method': return 'Incomplete';
        case 'requires_capture': return 'Ready';
        case 'canceled': return 'Cancelled';
        default: return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
    }
}
const flatten_payments = (args) => {
    const raw = Array.isArray(args.value) ? [...args.value] : [];
    const keyStr = String(args.key ?? 'created|desc');
    const [field, dir] = keyStr.split('|');
    const rows = raw.map(pi => {
        const customer = pi.customer;
        let customerName = '';
        if (customer && typeof customer === 'object') {
            const c = customer;
            customerName = String(c.name ?? c.email ?? '');
        }
        else {
            customerName = String(customer ?? '');
        }
        const created = typeof pi.created === 'number' ? pi.created : Number(pi.created ?? 0);
        let createdAt = '';
        if (created) {
            const d = new Date(created * 1000);
            const datePart = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
            const timePart = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
            createdAt = `${datePart}, ${timePart}`;
        }
        const pm = pi.payment_method ?? {};
        const card = pm.card ?? {};
        let method = '';
        if (card.brand) {
            const brand = String(card.brand);
            const brandDisplay = brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase();
            method = card.last4 ? `${brandDisplay} ••${card.last4}` : brandDisplay;
        }
        else {
            const types = Array.isArray(pi.payment_method_types) ? pi.payment_method_types : [];
            const t = types[0] ? String(types[0]) : '';
            method = t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
        }
        const status = String(pi.status ?? '');
        return {
            id: String(pi.id ?? ''),
            customer_name: customerName,
            created_at: createdAt,
            created_ts: created,
            amount: format_currency({ amount: pi.amount, currency: 'aud' }),
            amount_cents: typeof pi.amount === 'number' ? pi.amount : Number(pi.amount ?? 0),
            method,
            status,
            status_label: formatPaymentStatusLabel(status),
        };
    });
    rows.sort((a, b) => {
        const av = a[field] ?? '';
        const bv = b[field] ?? '';
        const an = Number(av);
        const bn = Number(bv);
        const cmp = !isNaN(an) && !isNaN(bn) ? an - bn : String(av).localeCompare(String(bv));
        return dir === 'desc' ? -cmp : cmp;
    });
    return rows.map(row => {
        const { created_ts: _ts, amount_cents: _ac, ...rest } = row;
        return rest;
    });
};
// ── balance_flow_tone ─────────────────────────────────────────────────────
// Tone for one of the two secondary balance figures (in transit / on hold).
// Zero is not a problem, so it stays neutral; a non-zero figure takes the
// tone that says what it means — money on its way out is good news (success),
// money being held back is a caveat (warning).
//
// Args: { amount: number, kind: 'in_transit' | 'on_hold' }
// Returns: 'muted' | 'success' | 'warning'
const balance_flow_tone = (args) => {
    const amount = Number(args.amount ?? 0);
    if (!Number.isFinite(amount) || amount === 0)
        return 'muted';
    return String(args.kind ?? '') === 'on_hold' ? 'warning' : 'success';
};
// ── balance_flow_note ─────────────────────────────────────────────────────
// Plain-English caption under a secondary balance figure, so a cell showing
// A$0.00 reads as "nothing to do" rather than as missing data.
//
// Args: { amount: number, kind: 'in_transit' | 'on_hold' }
// Returns: string
const balance_flow_note = (args) => {
    const amount = Number(args.amount ?? 0);
    const onHold = String(args.kind ?? '') === 'on_hold';
    if (!Number.isFinite(amount) || amount === 0) {
        return onHold ? 'Nothing pending' : 'Nothing on its way';
    }
    return onHold ? 'Clearing into your balance' : 'Paying out to your bank';
};
// ── percent_of ────────────────────────────────────────────────────────────
// What share one amount is of another, as a 0-100 number for ProgressBar.
// A zero or missing denominator gives 0 rather than NaN or Infinity.
//
// Args: { value: number, total: number }
// Returns: number
const percent_of = (args) => {
    const value = Number(args.value ?? 0);
    const total = Number(args.total ?? 0);
    if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0)
        return 0;
    return Math.max(0, Math.min(100, (value / total) * 100));
};
// ── balance_share_note ────────────────────────────────────────────────────
// Caption spelling out the bar: "Current balance is 97% of lifetime volume".
// Falls back to a statement of fact when there is no volume to compare with.
//
// Args: { value: number, total: number }
// Returns: string
const balance_share_note = (args) => {
    const total = Number(args.total ?? 0);
    if (!Number.isFinite(total) || total <= 0)
        return 'No charge volume recorded yet';
    const pct = Number(percent_of(args));
    return 'Current balance is ' + Math.round(pct) + '% of lifetime volume';
};
// ── flatten_customers ─────────────────────────────────────────────────────
// Pre-process raw Stripe customer objects into display-ready rows: a label
// that falls back to the email when the customer has no name, avatar
// initials, a dd-Mmm-yy join date, and the balance formatted in the
// customer's own currency with a tone that says which way it points.
//
// Stripe's `balance` is signed from the account's point of view: NEGATIVE is
// credit sitting on the customer's account, POSITIVE is an amount that will
// be added to their next invoice. Zero takes `default` rather than `muted`
// because `Text` silently drops to 11px when the tone is muted, which would
// make zero rows a different size from the rest of the column.
//
// Args: { value: raw customer array, key: sort key e.g. "created|desc" }
// Returns: display row array
/** "Ava Martinez" → AV; "noah.kim@example.com" → NK; "Amelia" → AM. */
function customerInitials(label) {
    const words = label.trim().split(/\s+/).filter(Boolean);
    if (words.length >= 2)
        return `${words[0][0]}${words[1][0]}`.toUpperCase();
    const local = (words[0] ?? '').split('@')[0];
    const parts = local.split(/[._-]+/).filter(Boolean);
    if (parts.length >= 2)
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return local.slice(0, 2).toUpperCase() || '\u00b7';
}
const flatten_customers = (args) => {
    const raw = Array.isArray(args.value) ? args.value : [];
    const keyStr = String(args.key ?? 'created|desc');
    const [field, dir] = keyStr.split('|');
    const rows = raw.map(c => {
        const name = String(c.name ?? '').trim();
        const email = String(c.email ?? '').trim();
        const label = name || email || '(No Name)';
        const balance = typeof c.balance === 'number' ? c.balance : Number(c.balance ?? 0);
        const safeBalance = Number.isFinite(balance) ? balance : 0;
        // A customer carries no currency until they transact; fall back to the
        // account default rather than letting format_currency guess.
        const currency = String(c.currency ?? '').trim() || 'aud';
        const created = typeof c.created === 'number' ? c.created : Number(c.created ?? 0);
        return {
            id: String(c.id ?? ''),
            name: label,
            email,
            // Initials come from the real name/email, never from the
            // "(No Name)" placeholder — that would read as "(N".
            initials: customerInitials(name || email),
            created: Number.isFinite(created) ? created : 0,
            created_label: String(format_stripe_date_dmy({ value: c.created })),
            balance: safeBalance,
            balance_label: String(format_currency({ amount: safeBalance, currency })),
            balance_tone: safeBalance < 0 ? 'success' : safeBalance > 0 ? 'warning' : 'default',
            livemode: Boolean(c.livemode),
        };
    });
    rows.sort((a, b) => {
        const av = a[field] ?? '';
        const bv = b[field] ?? '';
        const an = Number(av);
        const bn = Number(bv);
        const cmp = !isNaN(an) && !isNaN(bn) ? an - bn : String(av).localeCompare(String(bv));
        return dir === 'desc' ? -cmp : cmp;
    });
    return rows;
};
// ── invoice_board ─────────────────────────────────────────────────────────
// Everything the Invoices tile draws, from one pass over the raw invoices:
// the sorted rows plus the three headline figures above them.
//
// The key idea is that what the tile SHOWS is not always Stripe's status.
// Stripe has no "overdue" — an unpaid invoice stays `open` forever. So an
// open invoice past its due date is relabelled Overdue here, and the tone
// follows the display standard's escalation rather than the raw status:
// not yet due is muted, due today is warning, past due is destructive.
//
// Args: { value: raw invoice array, key: sort key e.g. "due_date_ts|desc",
//         today?: ISO date string for deterministic testing }
// Returns: { rows, count, outstanding, outstandingCount, outstandingTone,
//            overdueCount, overdueTone, paidTotal, paidCount, paidTone }
const invoice_board = (args) => {
    const raw = Array.isArray(args.value) ? args.value : [];
    const keyStr = String(args.key ?? 'due_date_ts|desc');
    const [field, dir] = keyStr.split('|');
    const today = args.today ? new Date(String(args.today)) : new Date();
    const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    let outstandingCents = 0;
    let outstandingCount = 0;
    let overdueCount = 0;
    let paidCents = 0;
    let paidCount = 0;
    // Invoices on one account share a currency; remember the last real one so
    // the headline figures aren't formatted with a guessed symbol.
    let currency = 'aud';
    const rows = raw.map(inv => {
        const status = String(inv.status ?? '').toLowerCase();
        const cents = typeof inv.amount_due === 'number' ? inv.amount_due : Number(inv.amount_due ?? 0);
        const amountCents = Number.isFinite(cents) ? cents : 0;
        const cur = String(inv.currency ?? '').trim();
        if (cur)
            currency = cur;
        const rawDue = typeof inv.due_date === 'number' ? inv.due_date : Number(inv.due_date ?? 0);
        const dueTs = Number.isFinite(rawDue) && rawDue > 0 ? rawDue : 0;
        let days = NaN;
        if (dueTs) {
            const d = new Date(dueTs * 1000);
            const dueUtc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
            days = Math.round((todayUtc - dueUtc) / 86_400_000);
        }
        let displayStatus = formatInvoiceStatusLabel(status);
        let displayTone = String(invoice_status_tone({ status }));
        let relLabel = '';
        if (status === 'paid') {
            paidCents += amountCents;
            paidCount += 1;
        }
        else if (status === 'open') {
            outstandingCents += amountCents;
            outstandingCount += 1;
            if (Number.isFinite(days)) {
                if (days > 0) {
                    displayStatus = 'Overdue';
                    displayTone = 'destructive';
                    relLabel = `${days}d overdue`;
                    overdueCount += 1;
                }
                else if (days === 0) {
                    displayTone = 'warning';
                    relLabel = 'due today';
                }
                else {
                    displayTone = 'muted';
                    relLabel = `in ${-days}d`;
                }
            }
        }
        return {
            id: String(inv.id ?? ''),
            customer_name: String(inv.customer_name ?? '').trim() || String(inv.customer_email ?? '').trim() || '(No Customer)',
            number: String(inv.number ?? ''),
            amount: String(format_currency({ amount: amountCents, currency: cur || currency })),
            amount_cents: amountCents,
            due_date: dueTs ? String(format_stripe_date_dmy({ value: dueTs })) : '—',
            // Sort key only (nothing displays it). An invoice with no due date
            // sorts last ascending rather than jumping above everything at 0.
            due_date_ts: dueTs || Number.MAX_SAFE_INTEGER,
            rel_label: relLabel,
            status,
            display_status: displayStatus,
            display_tone: displayTone,
            hosted_invoice_url: String(inv.hosted_invoice_url ?? ''),
        };
    });
    rows.sort((a, b) => {
        const av = a[field] ?? '';
        const bv = b[field] ?? '';
        const an = Number(av);
        const bn = Number(bv);
        const cmp = !isNaN(an) && !isNaN(bn) ? an - bn : String(av).localeCompare(String(bv));
        return dir === 'desc' ? -cmp : cmp;
    });
    return {
        rows,
        count: rows.length,
        outstanding: String(format_currency({ amount: outstandingCents, currency })),
        outstandingCount,
        // Tones stay data-driven: a headline only takes a status colour when it
        // has something to report, so an all-clear board reads quiet.
        outstandingTone: outstandingCents > 0 ? 'warning' : 'muted',
        overdueCount,
        overdueTone: overdueCount > 0 ? 'destructive' : 'muted',
        paidTotal: String(format_currency({ amount: paidCents, currency })),
        paidCount,
        paidTone: paidCents > 0 ? 'success' : 'muted',
    };
};
// ── payment_board ─────────────────────────────────────────────────────────
// Everything the Recent Payments tile draws, from one pass over the raw
// PaymentIntents: the sorted rows plus the three headline figures.
//
// Stripe has roughly eight PaymentIntent statuses. The headline figures
// collapse them into the three that matter to a business owner — money
// taken, money not taken yet, money that got away — while each ROW keeps
// Stripe's precise label, so "Action required" stays distinguishable from
// "Processing" even though both count as not-yet-collected above.
//
// Args: { value: raw PaymentIntent array, key: sort key e.g. "customer_name|asc" }
// Returns: { rows, count, succeededTotal, succeededCount, successRate, ...tones }
const payment_board = (args) => {
    const raw = Array.isArray(args.value) ? args.value : [];
    const keyStr = String(args.key ?? 'customer_name|asc');
    const [field, dir] = keyStr.split('|');
    let succeededCents = 0, succeededCount = 0;
    let pendingCents = 0, pendingCount = 0;
    let cancelledCents = 0, cancelledCount = 0;
    let currency = 'aud';
    const rows = raw.map(pi => {
        const status = String(pi.status ?? '').toLowerCase();
        const cents = typeof pi.amount === 'number' ? pi.amount : Number(pi.amount ?? 0);
        const amountCents = Number.isFinite(cents) ? cents : 0;
        const cur = String(pi.currency ?? '').trim();
        if (cur)
            currency = cur;
        // `customer` arrives expanded when the tool asked for it, a bare id when not.
        const customer = pi.customer;
        let customerName = '';
        if (customer && typeof customer === 'object') {
            const c = customer;
            customerName = String(c.name ?? c.email ?? '');
        }
        else {
            customerName = String(customer ?? '');
        }
        const created = typeof pi.created === 'number' ? pi.created : Number(pi.created ?? 0);
        let createdAt = '';
        if (Number.isFinite(created) && created > 0) {
            const d = new Date(created * 1000);
            const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            createdAt = `${format_stripe_date_dmy({ value: created })}, ${time}`;
        }
        // A card brand is worth reading; a bare "Card" is just the fallback, so
        // it drops to muted rather than competing with the real ones.
        const pm = pi.payment_method ?? {};
        const card = pm.card ?? {};
        let method = '';
        let methodTone = 'default';
        if (card.brand) {
            const brand = String(card.brand);
            const brandDisplay = brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase();
            method = card.last4 ? `${brandDisplay} ••${card.last4}` : brandDisplay;
        }
        else {
            const types = Array.isArray(pi.payment_method_types) ? pi.payment_method_types : [];
            const t = types[0] ? String(types[0]) : '';
            method = t ? t.charAt(0).toUpperCase() + t.slice(1) : '—';
            methodTone = 'muted';
        }
        if (status === 'succeeded') {
            succeededCents += amountCents;
            succeededCount += 1;
        }
        else if (status === 'canceled' || status === 'cancelled') {
            cancelledCents += amountCents;
            cancelledCount += 1;
        }
        else {
            pendingCents += amountCents;
            pendingCount += 1;
        }
        return {
            id: String(pi.id ?? ''),
            customer_name: customerName || '(No Customer)',
            created_at: createdAt,
            created_ts: Number.isFinite(created) ? created : 0,
            amount: String(format_currency({ amount: amountCents, currency: cur || currency })),
            amount_cents: amountCents,
            method,
            method_tone: methodTone,
            status,
            status_label: formatPaymentStatusLabel(status),
            status_tone: String(payment_intent_status_tone({ status })),
        };
    });
    rows.sort((a, b) => {
        const av = a[field] ?? '';
        const bv = b[field] ?? '';
        const an = Number(av);
        const bn = Number(bv);
        const cmp = !isNaN(an) && !isNaN(bn) ? an - bn : String(av).localeCompare(String(bv));
        return dir === 'desc' ? -cmp : cmp;
    });
    const total = rows.length;
    const successRate = total > 0 ? Math.round((succeededCount / total) * 100) : 0;
    return {
        rows,
        count: total,
        succeededTotal: String(format_currency({ amount: succeededCents, currency })),
        succeededCount,
        successRate,
        // Tones stay data-driven: a bucket only takes a status colour when it has
        // something in it, so a clean run doesn't show a permanent red dot.
        succeededTone: succeededCount > 0 ? 'success' : 'muted',
        pendingCount,
        pendingTotal: String(format_currency({ amount: pendingCents, currency })),
        pendingTone: pendingCount > 0 ? 'warning' : 'muted',
        cancelledCount,
        cancelledTotal: String(format_currency({ amount: cancelledCents, currency })),
        cancelledTone: cancelledCount > 0 ? 'destructive' : 'muted',
    };
};
// ── subscription_board ────────────────────────────────────────────────────────
// One pass over the raw subscription list that returns both the headline
// figures and the display rows, so the tile never asks two helpers the same
// question and risks two answers.
//
// MRR normalises every plan to a monthly figure (toMonthlyCents), but each row
// shows what the customer is ACTUALLY charged and how often — a yearly plan
// reads "A$1,188.00 / year", not a normalised monthly slice that never appears
// on a statement.
//
// Args: { value: raw subscription array, key: "field|dir", today?: ISO date }
// Returns: { rows, count, activeCount, mrr, mrrCents, mrrTone, countTone, currency }
/** "/ month", "/ year", "/ 3 months" — the cadence as the customer reads it. */
function intervalLabel(interval, count) {
    const unit = interval || 'month';
    if (!Number.isFinite(count) || count <= 1)
        return `/ ${unit}`;
    return `/ ${count} ${unit}s`;
}
const subscription_board = (args) => {
    const subs = Array.isArray(args.value) ? args.value : [];
    const keyStr = String(args.key ?? 'customer_name|asc');
    const [field, dir] = keyStr.split('|');
    const today = args.today ? new Date(String(args.today)) : new Date();
    const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    // Stripe counts a subscription toward recurring revenue while it is live and
    // priced: active and past_due. A trial is not revenue yet; canceled,
    // incomplete and unpaid are not revenue any more.
    const BILLING = new Set(['active', 'past_due']);
    let currency = 'aud';
    let mrrCents = 0;
    let activeCount = 0;
    const rows = subs.map((sub) => {
        const status = String(sub.status ?? '').toLowerCase();
        const items = sub.items?.data ?? [];
        const customer = sub.customer;
        let customerName = '';
        let customerEmail = '';
        if (customer && typeof customer === 'object') {
            const c = customer;
            customerName = String(c.name ?? c.email ?? '');
            customerEmail = String(c.email ?? '');
        }
        else {
            customerName = String(customer ?? '');
        }
        const first = items[0] ?? {};
        const price = first.price ?? {};
        const product = price.product ?? {};
        let planName = String(product.name ?? price.nickname ?? price.id ?? '');
        // A multi-line subscription bills as one amount, so say there is more
        // rather than silently showing only the first product's name.
        if (items.length > 1)
            planName = `${planName} +${items.length - 1} more`;
        const cur = String(price.currency ?? sub.currency ?? '').trim();
        if (cur)
            currency = cur;
        // Charged amount is what the invoice says; monthly is the MRR equivalent.
        let chargedCents = 0;
        let monthlyCents = 0;
        for (const item of items) {
            const p = item.price ?? {};
            const unit = typeof p.unit_amount === 'number' ? p.unit_amount : 0;
            const qty = typeof item.quantity === 'number' ? item.quantity : 1;
            chargedCents += unit * qty;
            monthlyCents += toMonthlyCents(item);
        }
        const recurring = price.recurring ?? {};
        const interval = String(recurring.interval ?? 'month');
        const intervalCount = typeof recurring.interval_count === 'number' ? recurring.interval_count : 1;
        if (BILLING.has(status)) {
            mrrCents += monthlyCents;
            activeCount += 1;
        }
        // current_period_end sits on the subscription on the API version this
        // connector pins, and on each item on newer ones. Take whichever is there.
        let nextTs = typeof sub.current_period_end === 'number' ? sub.current_period_end : 0;
        if (!nextTs && typeof first.current_period_end === 'number') {
            nextTs = first.current_period_end;
        }
        let days = NaN;
        if (nextTs) {
            const d = new Date(nextTs * 1000);
            days = Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - todayUtc) / 86_400_000);
        }
        // The countdown only takes a status colour when something is really going
        // on. An ordinary renewal is a date, not a warning.
        let relLabel = '';
        let relTone = 'muted';
        const ending = Boolean(sub.cancel_at_period_end);
        if (status === 'past_due') {
            relLabel = 'Payment overdue';
            relTone = 'destructive';
        }
        else if (status === 'canceled' || status === 'incomplete_expired') {
            relLabel = 'Ended';
        }
        else if (Number.isFinite(days)) {
            const when = days === 0 ? 'today'
                : days === 1 ? 'tomorrow'
                    : days > 0 ? `in ${days}d`
                        : `${-days}d ago`;
            if (ending) {
                relLabel = `Ends ${when}`;
                relTone = 'warning';
            }
            else if (status === 'trialing') {
                relLabel = `Trial ends ${when}`;
                // `info` resolves to plain foreground on text, so a trial borrows the
                // brand colour to stay visibly a state of its own.
                relTone = 'brand';
            }
            else {
                relLabel = when.charAt(0).toUpperCase() + when.slice(1);
            }
        }
        return {
            id: String(sub.id ?? ''),
            customer_name: customerName,
            customer_email: customerEmail,
            plan_name: planName,
            amount: String(format_currency({ amount: chargedCents, currency: cur || currency })),
            amount_cents: chargedCents,
            interval_label: intervalLabel(interval, intervalCount),
            next_bill: nextTs ? String(format_stripe_date_dmy({ value: nextTs })) : '—',
            // Sort key only, never displayed. A subscription with no period end
            // sorts last ascending instead of jumping above every real date at 0.
            next_bill_ts: nextTs || Number.MAX_SAFE_INTEGER,
            rel_label: relLabel,
            rel_tone: relTone,
            status,
            status_label: formatSubscriptionStatusLabel(status),
        };
    });
    rows.sort((a, b) => {
        const av = a[field] ?? '';
        const bv = b[field] ?? '';
        const an = Number(av);
        const bn = Number(bv);
        // Number('') is 0, not NaN, so blanks would sort as zero in a numeric
        // column without this guard.
        const numeric = av !== '' && bv !== '' && !isNaN(an) && !isNaN(bn);
        const cmp = numeric ? an - bn : String(av).localeCompare(String(bv));
        return dir === 'desc' ? -cmp : cmp;
    });
    return {
        rows,
        count: rows.length,
        activeCount,
        mrr: String(format_currency({ amount: mrrCents, currency })),
        mrrCents,
        currency,
        // Zero is not a failure, just nothing yet, so it stays uncoloured.
        mrrTone: mrrCents > 0 ? 'success' : 'muted',
        // `info` is colourless on an icon, so the subscriber count uses the brand
        // tone where the mockup used blue.
        countTone: activeCount > 0 ? 'brand' : 'muted',
    };
};
const elements = {
    slug: 'stripe',
    functions: {
        format_currency,
        sort_by_key,
        cycle_sort,
        set_sort_field,
        subscription_status_tone,
        invoice_status_tone,
        payment_intent_status_tone,
        format_stripe_date,
        format_stripe_date_dmy,
        format_stripe_date_short,
        build_customer_url,
        flatten_invoices,
        calc_mrr,
        flatten_subscriptions,
        flatten_payments,
        flatten_customers,
        invoice_board,
        payment_board,
        subscription_board,
        balance_flow_tone,
        balance_flow_note,
        percent_of,
        balance_share_note,
    },
};
export default elements;
