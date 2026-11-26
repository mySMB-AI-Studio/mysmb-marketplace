const STATUS_LABEL = {
    OPEN: 'Open', COMPLETED: 'Completed', CANCELED: 'Cancelled',
};
const STATUS_TONE = {
    OPEN: 'info', COMPLETED: 'success', CANCELED: 'muted',
};
const enrich_orders = (args) => {
    const orders = args.value;
    if (!Array.isArray(orders))
        return [];
    return orders.map((o) => {
        const order = o;
        const state = String(order.state ?? '');
        return {
            ...order,
            order_id_short: `#${String(order.id ?? '').slice(-8).toUpperCase()}`,
            status_label: STATUS_LABEL[state] ?? state,
            status_tone: STATUS_TONE[state] ?? 'muted',
        };
    });
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Ava Martinez" -> "AM". Avatar renders at most two characters anyway. */
function initialsOf(name) {
    const words = name.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0)
        return '?';
    if (words.length === 1)
        return words[0].slice(0, 2);
    return words[0][0] + words[words.length - 1][0];
}
/**
 * Read the connector's dd-Mmm-yy back into a UTC day. Square dates are
 * formatted server-side, so this is the only way to say how long ago a visit
 * was without a second round trip. Returns null for the connector's "—".
 */
function parseDmy(value) {
    const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/.exec(value.trim());
    if (!m)
        return null;
    const month = MONTHS.indexOf(m[2][0].toUpperCase() + m[2].slice(1).toLowerCase());
    if (month < 0)
        return null;
    return Date.UTC(2000 + Number(m[3]), month, Number(m[1]));
}
/** "Today", "Yesterday", "12d ago", "4mo ago" — how cold the relationship is. */
function visitNote(lastVisit, todayUtc) {
    const ts = parseDmy(lastVisit);
    if (ts === null)
        return '';
    const days = Math.round((todayUtc - ts) / 86_400_000);
    if (days <= 0)
        return 'Today';
    if (days === 1)
        return 'Yesterday';
    if (days < 30)
        return `${days}d ago`;
    return `${Math.round(days / 30)}mo ago`;
}
/**
 * The connector formats money before the tile sees it, so there is no currency
 * code to work from — only strings like "A$256.00". Lift the prefix off one of
 * them rather than assuming AUD, which would misprice a US or NZ seller.
 */
function symbolOf(display) {
    const m = /^[^\d-]*/.exec(display);
    return m ? m[0] : '';
}
function formatMoney(cents, symbol) {
    const amount = (cents / 100).toLocaleString('en-AU', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    return `${symbol}${amount}`;
}
/**
 * Apply a `"field|dir"` sort key to a set of board rows, in place.
 *
 * Numeric columns compare as numbers and everything else with
 * localeCompare. The blank guard matters: Number('') is 0, not NaN, so a
 * row with nothing in a numeric column would otherwise sort as if it held
 * zero and jump above real values in an ascending column.
 */
function applySort(rows, key) {
    const [field, dir] = String(key).split('|');
    if (!field)
        return;
    rows.sort((a, b) => {
        const av = a[field] ?? '';
        const bv = b[field] ?? '';
        const an = Number(av);
        const bn = Number(bv);
        const numeric = av !== '' && bv !== '' && !isNaN(an) && !isNaN(bn);
        const cmp = numeric ? an - bn : String(av).localeCompare(String(bv));
        return dir === 'desc' ? -cmp : cmp;
    });
}
/**
 * Work out the next sort key when a column header is clicked.
 *
 * Clicking the column already sorted flips its direction. Clicking a
 * different one starts it at `defaultDir`, which lets a money or count
 * column open on its big end — the first thing anyone wants from
 * "total spent" is the largest, not A$0.00.
 *
 * args.current    — the active "field|dir" key
 * args.field      — the column clicked
 * args.defaultDir — direction for a column not currently sorted (default asc)
 */
const set_sort_field = (args) => {
    const [currentField, currentDir] = String(args.current ?? '').split('|');
    const field = String(args.field ?? '');
    if (!field)
        return String(args.current ?? '');
    if (currentField === field)
        return `${field}|${currentDir === 'desc' ? 'asc' : 'desc'}`;
    return `${field}|${args.defaultDir === 'desc' ? 'desc' : 'asc'}`;
};
/**
 * Turn get_customer_orders_summary's customer rows into everything the
 * Customers tile draws: initials and avatar tone, a spend bar measured
 * against the top spender, how long since each last visit, and the two
 * headline figures the connector does not return (total spent across the
 * book, and what share of customers have ever bought).
 *
 * args.value  — the `customers` array
 * args.sample — any already-formatted money string from the same response
 *               (avg_spend_display), used only to learn the currency symbol
 * args.today  — optional ISO date, for testing; defaults to now
 * args.key    — "field|dir" sort key; defaults to the connector's own
 *               order, biggest spender first
 */
const customer_board = (args) => {
    const list = Array.isArray(args.value) ? args.value : [];
    const today = args.today ? new Date(String(args.today)) : new Date();
    const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    let totalCents = 0;
    let maxCents = 0;
    let symbol = symbolOf(String(args.sample ?? ''));
    for (const c of list) {
        const cents = Number(c.total_spent_cents) || 0;
        totalCents += cents;
        if (cents > maxCents)
            maxCents = cents;
        if (!symbol)
            symbol = symbolOf(String(c.total_spent_display ?? ''));
    }
    // Only one row wears the badge. Keying off the running maximum rather than
    // position means a tie, or a response that arrives unsorted, still tags
    // exactly one customer instead of none or several.
    let toppedAlready = false;
    const rows = list.map((c, i) => {
        const name = String(c.name ?? '');
        const count = Number(c.order_count) || 0;
        const cents = Number(c.total_spent_cents) || 0;
        const hasOrders = count > 0;
        const lastVisit = String(c.last_visit ?? '');
        const isTop = hasOrders && cents === maxCents && !toppedAlready;
        if (isTop)
            toppedAlready = true;
        return {
            // No id comes back from the connector, so fall back through email and
            // name before position — a stable key keeps repeat from re-mounting
            // every row when the list refreshes.
            id: String(c.email || name || i),
            name,
            initials: initialsOf(name),
            // A customer who has never bought gets a grey mark: the row is a
            // prompt to follow up, not a record of custom.
            avatar_tone: hasOrders ? 'brand' : 'muted',
            order_count: count,
            orders_label: count === 1 ? 'order' : 'orders',
            total_spent: String(c.total_spent_display ?? formatMoney(cents, symbol)),
            // Share of the top spender's total, so the bars read against the
            // leader of this book rather than an arbitrary ceiling.
            spend_pct: maxCents > 0 ? Math.round((cents / maxCents) * 100) : 0,
            has_orders: hasOrders,
            no_orders: !hasOrders,
            is_top: isTop,
            // Sort keys, never displayed. The date arrives pre-formatted, so the
            // column needs a real timestamp to order by. A customer who has never
            // visited gets zero: last in a most-recent-first column, first when
            // the column is flipped, which is the "who have we not seen" view.
            total_spent_cents: cents,
            last_visit_ts: parseDmy(lastVisit) ?? 0,
            last_visit: lastVisit || '—',
            visit_note: visitNote(lastVisit, todayUtc),
        };
    });
    applySort(rows, String(args.key ?? 'total_spent_cents|desc'));
    const withOrders = rows.filter((r) => r.has_orders).length;
    return {
        rows,
        count: rows.length,
        with_orders: withOrders,
        with_orders_note: rows.length > 0
            ? `${Math.round((withOrders / rows.length) * 100)}% of customers`
            : 'No customers yet',
        total_spent: formatMoney(totalCents, symbol),
    };
};
/**
 * Pull cents back out of a string the connector already formatted
 * ("A$1,250.00" -> 125000). get_latest_payments returns only the display
 * string, so this is the only way the tile can total, average or compare
 * payments. Safe to parse because the same server-side formatter produced
 * every one of them: en-AU grouping, always two decimal places.
 */
function parseMoneyCents(display) {
    const m = /-?[\d,]+(?:\.\d+)?/.exec(String(display));
    if (!m)
        return 0;
    const value = Number(m[0].replace(/,/g, ''));
    return Number.isFinite(value) ? Math.round(value * 100) : 0;
}
/**
 * Turn get_latest_payments' rows into what the Latest Payments tile draws:
 * the three headline figures the connector does not return — total taken,
 * average payment and largest — plus a bar per payment measured against
 * the largest one in the window.
 *
 * args.value — the `payments` array
 * args.key   — "field|dir" sort key; defaults to the order the connector
 *              returned, which is newest first
 */
const payment_board = (args) => {
    const list = Array.isArray(args.value) ? args.value : [];
    const cents = [];
    let totalCents = 0;
    let maxCents = 0;
    let symbol = '';
    for (const p of list) {
        const display = String(p.amount_display ?? '');
        const c = parseMoneyCents(display);
        cents.push(c);
        totalCents += c;
        if (c > maxCents)
            maxCents = c;
        if (!symbol)
            symbol = symbolOf(display);
    }
    // Only one row wears the badge, and only when there is something to be
    // largest than — a lone payment is not a standout.
    let largestTagged = false;
    const rows = list.map((p, i) => {
        const name = String(p.name ?? '').trim();
        const c = cents[i];
        const isLargest = list.length > 1 && c > 0 && c === maxCents && !largestTagged;
        if (isLargest)
            largestTagged = true;
        return {
            id: String(p.id ?? i),
            // "Guest" is what the connector calls a payment with nobody attached.
            // Alone it reads like a name; as "Guest checkout" it reads like what
            // it is. A payment that does have a customer keeps their real name.
            title: name && name.toLowerCase() !== 'guest' ? name : 'Guest checkout',
            sub_label: String(p.sub_label ?? ''),
            amount: String(p.amount_display ?? ''),
            // Share of the largest payment in this window, so the bars compare
            // takings against each other rather than an arbitrary ceiling.
            amount_pct: maxCents > 0 ? Math.round((c / maxCents) * 100) : 0,
            is_largest: isLargest,
            // Sort keys, never displayed. There is no timestamp on a payment row —
            // only a formatted time — so position stands in for recency, which is
            // exact because the connector already returned them newest first.
            amount_cents: c,
            order_index: i,
        };
    });
    applySort(rows, String(args.key ?? 'order_index|asc'));
    const avgCents = rows.length > 0 ? Math.round(totalCents / rows.length) : 0;
    return {
        rows,
        count: rows.length,
        count_note: rows.length === 1 ? '1 payment' : `${rows.length} payments`,
        total: formatMoney(totalCents, symbol),
        average: formatMoney(avgCents, symbol),
        largest: formatMoney(maxCents, symbol),
    };
};
/**
 * Statuses where the invoice is closed: nobody is going to pay it now, so it
 * sits below the live ones and is left out of what is still owed. Mirrors the
 * connector's own outstanding filter so the tile's figure agrees with the
 * `outstanding_display` it returns.
 */
const SETTLED_STATUSES = new Set(['Paid', 'Cancelled', 'Refunded']);
/**
 * How loudly each status asks to be dealt with. Sorting the status column
 * alphabetically would put Draft above Overdue, which is backwards; this
 * puts the money at risk first and the closed invoices last.
 */
const STATUS_RANK = {
    Overdue: 0, Failed: 1, 'Part Paid': 2, Sent: 3, Scheduled: 4, Draft: 5,
    Paid: 10, 'Part Refunded': 11, Refunded: 12, Cancelled: 13,
};
/**
 * Turn get_recent_invoices' rows into what the Recent Invoices tile draws.
 *
 * The connector returns a status label and tone per invoice but no money it
 * can be totalled by and no ordering, so this does three things it cannot:
 * puts unpaid invoices first with the soonest due date on top, totals what is
 * owed against what has been collected, and says how far off each due date is
 * ("Due today", "In 21 days", "3d overdue").
 *
 * args.value — the `invoices` array
 * args.today — optional ISO date, for testing; defaults to now
 * args.key   — "field|dir" sort key; defaults to "priority", the two-level
 *              order below
 */
const invoice_board = (args) => {
    const list = Array.isArray(args.value) ? args.value : [];
    const today = args.today ? new Date(String(args.today)) : new Date();
    const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    let symbol = '';
    let outstandingCents = 0;
    let paidCents = 0;
    let unpaidCount = 0;
    let paidCount = 0;
    let overdueCount = 0;
    const rows = list.map((inv, i) => {
        const status = String(inv.status_label ?? '');
        const tone = String(inv.status_tone ?? 'muted');
        const display = String(inv.amount_display ?? '');
        const cents = parseMoneyCents(display);
        if (!symbol)
            symbol = symbolOf(display);
        const settled = SETTLED_STATUSES.has(status);
        if (status === 'Paid') {
            paidCents += cents;
            paidCount += 1;
        }
        if (!settled) {
            outstandingCents += cents;
            unpaidCount += 1;
        }
        if (status === 'Overdue')
            overdueCount += 1;
        const due = String(inv.due_display ?? '');
        const dueTs = parseDmy(due);
        // A settled invoice gets no countdown — "in 14 days" under a paid invoice
        // is noise, and under a cancelled one it is wrong.
        let dueNote = '';
        // The caption's colour comes from the caption's own arithmetic rather
        // than the connector's status, so "3d overdue" can never render amber.
        // In practice the two agree: both are measured against the same day.
        let dueTone = tone;
        if (!settled && dueTs !== null) {
            const days = Math.round((dueTs - todayUtc) / 86_400_000);
            if (days < 0) {
                dueNote = `${-days}d overdue`;
                dueTone = 'destructive';
            }
            else if (days === 0) {
                dueNote = 'Due today';
                dueTone = 'warning';
            }
            else if (days === 1) {
                dueNote = 'In 1 day';
                dueTone = 'warning';
            }
            else {
                dueNote = `In ${days} days`;
                dueTone = 'warning';
            }
        }
        return {
            id: String(inv.invoice_number ?? i),
            customer_name: String(inv.customer_name ?? ''),
            invoice_ref: `#${String(inv.invoice_number ?? '')}`,
            amount: display,
            status_label: status,
            status_tone: tone,
            due_display: due || '—',
            due_note: dueNote,
            due_tone: dueTone,
            settled,
            // Sort keys, never displayed. STATUS orders by how much attention the
            // invoice wants rather than alphabetically, where Draft would outrank
            // Overdue for no reason anyone would recognise.
            amount_cents: cents,
            status_rank: STATUS_RANK[status] ?? 50,
            // Sort key only, never displayed. An invoice with no due date sorts last
            // instead of leaping to the top of an ascending date column at zero.
            due_ts: dueTs === null ? Number.MAX_SAFE_INTEGER : dueTs,
        };
    });
    // "priority" is the tile's own default and cannot be expressed as one
    // field: what still needs doing first, soonest deadline on top, then
    // everything closed below it, also by date. Any other key is a plain
    // column sort the reader asked for.
    // Settle ties by due date before any column sort runs. Array.sort is
    // stable, so two invoices with the same status or the same amount then
    // keep deadline order rather than whatever order Square listed them in.
    rows.sort((a, b) => a.due_ts - b.due_ts);
    const key = String(args.key ?? 'priority|asc');
    if (key.split('|')[0] === 'priority') {
        rows.sort((a, b) => {
            if (a.settled !== b.settled)
                return a.settled ? 1 : -1;
            return a.due_ts - b.due_ts;
        });
    }
    else {
        applySort(rows, key);
    }
    const billableCents = outstandingCents + paidCents;
    const collectedPct = billableCents > 0 ? Math.round((paidCents / billableCents) * 100) : 0;
    return {
        rows,
        count: rows.length,
        count_note: rows.length === 1 ? '1 invoice' : `${rows.length} invoices`,
        outstanding: formatMoney(outstandingCents, symbol),
        outstanding_note: unpaidCount === 1 ? '1 unpaid' : `${unpaidCount} unpaid`,
        overdue_count: overdueCount,
        overdue_note: overdueCount > 0 ? 'Need chasing' : 'All on time',
        overdue_tone: overdueCount > 0 ? 'destructive' : 'success',
        paid: formatMoney(paidCents, symbol),
        paid_note: paidCount === 1 ? '1 invoice' : `${paidCount} invoices`,
        collected_pct: collectedPct,
        collected_note: `${collectedPct}% of ${formatMoney(billableCents, symbol)}`,
    };
};
/**
 * How Square names the money it hands back, as the connector formats it.
 * search_orders returns a real currency code rather than a pre-formatted
 * string, so an order total can be printed properly instead of parsed out of
 * one — but it has to agree with the server's own formatMoney to the letter,
 * or two tiles on the same dashboard would spell the same dollar differently.
 */
const CURRENCY_PREFIX = { AUD: 'A$', NZD: 'NZ$', USD: '$' };
function formatCurrencyAmount(cents, currency) {
    const prefix = CURRENCY_PREFIX[currency] ?? (currency ? `${currency} ` : '');
    return formatMoney(cents, prefix);
}
const ORDER_STATE_LABEL = {
    OPEN: 'Open', COMPLETED: 'Completed', CANCELED: 'Cancelled', DRAFT: 'Draft',
};
/**
 * Open before completed before cancelled: an order still open is the only one
 * on the tile anybody can still act on.
 */
const ORDER_STATE_RANK = {
    OPEN: 0, DRAFT: 1, COMPLETED: 2, CANCELED: 3,
};
const ORDER_STATE_TONE = {
    // Amber is "not finished yet", the same reading a sent invoice gets on the
    // Invoices tile — not a warning that something has gone wrong.
    OPEN: 'warning', DRAFT: 'muted', COMPLETED: 'success', CANCELED: 'muted',
};
/** "Just now", "7m ago", "2h ago", "3d ago", then the plain date past a week. */
function relativeTime(iso, nowMs) {
    const ts = Date.parse(iso);
    if (Number.isNaN(ts))
        return '';
    const secs = Math.round((nowMs - ts) / 1000);
    if (secs < 60)
        return 'Just now';
    const mins = Math.round(secs / 60);
    if (mins < 60)
        return `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24)
        return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days < 7)
        return `${days}d ago`;
    const d = new Date(ts);
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${day}-${MONTHS[d.getUTCMonth()]}-${String(d.getUTCFullYear()).slice(-2)}`;
}
/**
 * Turn raw search_orders results into what the Recent Orders tile draws.
 *
 * Unlike the other Square tools this one hands back Square's own order
 * objects, untouched — so everything the tile shows is derived here: the short
 * reference, the state label and tone, the money, how long ago it was taken,
 * and the split of order value between what is still open and what has
 * completed.
 *
 * args.value — the `orders` array from search_orders
 * args.key   — "field|dir" sort key; defaults to newest first
 * args.now   — optional ISO timestamp, for testing; defaults to now
 */
const order_board = (args) => {
    const list = Array.isArray(args.value) ? args.value : [];
    const nowMs = args.now ? Date.parse(String(args.now)) : Date.now();
    let currency = '';
    let totalCents = 0;
    let openCents = 0;
    let doneCents = 0;
    let openCount = 0;
    let doneCount = 0;
    const rows = list.map((o, i) => {
        const money = o.total_money ?? {};
        const cents = Number(money.amount) || 0;
        const cur = String(money.currency ?? '');
        if (cur && !currency)
            currency = cur;
        const state = String(o.state ?? '').toUpperCase();
        // A cancelled order is worth nothing, so it is counted as an order but
        // adds to neither side of the split. Keeping it out of the total as well
        // is what makes open + completed reconcile with it, and keeps cancelled
        // money out of the denominator of the completed share.
        if (state === 'COMPLETED') {
            doneCents += cents;
            doneCount += 1;
            totalCents += cents;
        }
        else if (state !== 'CANCELED') {
            openCents += cents;
            openCount += 1;
            totalCents += cents;
        }
        const createdAt = String(o.created_at ?? '');
        const items = Array.isArray(o.line_items) ? o.line_items : [];
        const itemCount = items.reduce((sum, li) => sum + (Number(li.quantity) || 1), 0);
        const rel = relativeTime(createdAt, nowMs);
        const itemsLabel = itemCount === 1 ? '1 item' : `${itemCount} items`;
        return {
            id: String(o.id ?? i),
            // Square ids are 28 characters of noise. The tail is what its own
            // dashboard shows and what a merchant would read out loud.
            order_ref: `#${String(o.id ?? '').slice(-8).toUpperCase()}`,
            source_name: String((o.source ?? {}).name ?? 'Point of Sale'),
            meta: rel ? `${itemsLabel} · ${rel}` : itemsLabel,
            amount: formatCurrencyAmount(cents, cur),
            status_label: ORDER_STATE_LABEL[state] ?? state,
            status_tone: ORDER_STATE_TONE[state] ?? 'muted',
            // Sort keys, never displayed.
            amount_cents: cents,
            status_rank: ORDER_STATE_RANK[state] ?? 50,
            created_ts: Date.parse(createdAt) || 0,
        };
    });
    // Settle ties by recency before any column sort runs. Array.sort is stable,
    // so two orders of the same value or the same state keep newest-first order.
    rows.sort((a, b) => b.created_ts - a.created_ts);
    applySort(rows, String(args.key ?? 'created_ts|desc'));
    const completedPct = totalCents > 0 ? Math.round((doneCents / totalCents) * 100) : 0;
    return {
        rows,
        count: rows.length,
        total_value: formatCurrencyAmount(totalCents, currency),
        total_note: `${formatCurrencyAmount(totalCents, currency)} total value`,
        open_value: formatCurrencyAmount(openCents, currency),
        open_note: openCount === 1 ? '1 order' : `${openCount} orders`,
        done_value: formatCurrencyAmount(doneCents, currency),
        done_note: doneCount === 1 ? '1 order' : `${doneCount} orders`,
        completed_pct: completedPct,
        completed_note: `${completedPct}% of order value`,
    };
};
const mod = {
    slug: 'square',
    functions: {
        enrich_orders, customer_board, payment_board, invoice_board, order_board, set_sort_field,
    },
};
export default mod;
