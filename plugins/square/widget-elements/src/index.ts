import type { ComputedFunction, PluginElementsModule } from './types';

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Open', COMPLETED: 'Completed', CANCELED: 'Cancelled',
};
const STATUS_TONE: Record<string, string> = {
  OPEN: 'info', COMPLETED: 'success', CANCELED: 'muted',
};

const enrich_orders: ComputedFunction = (args) => {
  const orders = args.value;
  if (!Array.isArray(orders)) return [];
  return orders.map((o) => {
    const order = o as Record<string, unknown>;
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
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2);
  return words[0][0] + words[words.length - 1][0];
}

/**
 * Read the connector's dd-Mmm-yy back into a UTC day. Square dates are
 * formatted server-side, so this is the only way to say how long ago a visit
 * was without a second round trip. Returns null for the connector's "—".
 */
function parseDmy(value: string): number | null {
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const month = MONTHS.indexOf(m[2][0].toUpperCase() + m[2].slice(1).toLowerCase());
  if (month < 0) return null;
  return Date.UTC(2000 + Number(m[3]), month, Number(m[1]));
}

/** "Today", "Yesterday", "12d ago", "4mo ago" — how cold the relationship is. */
function visitNote(lastVisit: string, todayUtc: number): string {
  const ts = parseDmy(lastVisit);
  if (ts === null) return '';
  const days = Math.round((todayUtc - ts) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  return `${Math.round(days / 30)}mo ago`;
}

/**
 * The connector formats money before the tile sees it, so there is no currency
 * code to work from — only strings like "A$256.00". Lift the prefix off one of
 * them rather than assuming AUD, which would misprice a US or NZ seller.
 */
function symbolOf(display: string): string {
  const m = /^[^\d-]*/.exec(display);
  return m ? m[0] : '';
}

function formatMoney(cents: number, symbol: string): string {
  const amount = (cents / 100).toLocaleString('en-AU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${amount}`;
}

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
 */
const customer_board: ComputedFunction = (args) => {
  const list = Array.isArray(args.value) ? (args.value as Record<string, unknown>[]) : [];
  const today = args.today ? new Date(String(args.today)) : new Date();
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());

  let totalCents = 0;
  let maxCents = 0;
  let symbol = symbolOf(String(args.sample ?? ''));
  for (const c of list) {
    const cents = Number(c.total_spent_cents) || 0;
    totalCents += cents;
    if (cents > maxCents) maxCents = cents;
    if (!symbol) symbol = symbolOf(String(c.total_spent_display ?? ''));
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
    if (isTop) toppedAlready = true;
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
      last_visit: lastVisit || '—',
      visit_note: visitNote(lastVisit, todayUtc),
    };
  });

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

const mod: PluginElementsModule = {
  slug: 'square',
  functions: { enrich_orders, customer_board },
};

export default mod;
