import type { ComputedFunction, PluginElementsModule } from './types.js';

/**
 * Odoo's native MCP server (ai_tool_search / ai_tool_read_group) is a
 * generic, model-agnostic query interface — not per-resource tools like
 * every other connector in this marketplace. Two real constraints this
 * file works around (confirmed live against a real Odoo instance while
 * building this plugin, not from docs — Odoo's native MCP has none):
 *
 * 1. Selection fields (state, payment_state, ...) come back as their raw
 *    technical key ("draft", "not_paid"), never the human label — these
 *    lookup tables translate them, mirroring each field's own
 *    `selection({...})` definition from ai_tool_get_fields.
 * 2. Relational fields (partner_id, ...) come back as a bare integer ID
 *    only — ai_tool_search explicitly refuses dot-paths like
 *    "partner_id.name". Resolving a customer/vendor name would need a
 *    SECOND ai_tool_search call, but the host writes every tool result to
 *    the fixed path `/odoo/ai_tool_search` regardless of which model was
 *    queried — a second call on the same card would clobber the first
 *    one's result at that exact path. That's a real platform limitation,
 *    not something fixable from widget-elements, so these first Odoo
 *    tiles deliberately don't attempt a client-side join; a proper fix
 *    is a dedicated myhub-mcp-servers backend tool (like the odoo-extract
 *    integration) that resolves names server-side.
 */

/** sale.order.state → {label, tone}. Args: { value: string } */
const sale_order_state: ComputedFunction = (args) => {
  const v = String(args.value ?? '');
  const map: Record<string, { label: string; tone: string }> = {
    draft: { label: 'Quotation', tone: 'muted' },
    sent: { label: 'Quotation Sent', tone: 'info' },
    sale: { label: 'Sales Order', tone: 'success' },
    cancel: { label: 'Cancelled', tone: 'destructive' },
  };
  return map[v] ?? { label: v || 'Unknown', tone: 'muted' };
};
const sale_order_state_label: ComputedFunction = (args) =>
  (sale_order_state(args) as { label: string }).label;
const sale_order_state_tone: ComputedFunction = (args) =>
  (sale_order_state(args) as { tone: string }).tone;

/** account.move.state → {label, tone}. Args: { value: string } */
const move_state: ComputedFunction = (args) => {
  const v = String(args.value ?? '');
  const map: Record<string, { label: string; tone: string }> = {
    draft: { label: 'Draft', tone: 'muted' },
    posted: { label: 'Posted', tone: 'success' },
    cancel: { label: 'Cancelled', tone: 'destructive' },
  };
  return map[v] ?? { label: v || 'Unknown', tone: 'muted' };
};
const move_state_label: ComputedFunction = (args) => (move_state(args) as { label: string }).label;

/** account.move.payment_state → {label, tone}. Args: { value: string } */
const payment_state: ComputedFunction = (args) => {
  const v = String(args.value ?? '');
  const map: Record<string, { label: string; tone: string }> = {
    not_paid: { label: 'Not Paid', tone: 'warning' },
    in_payment: { label: 'In Payment', tone: 'info' },
    paid: { label: 'Paid', tone: 'success' },
    partial: { label: 'Partially Paid', tone: 'warning' },
    reversed: { label: 'Reversed', tone: 'muted' },
    blocked: { label: 'Blocked', tone: 'destructive' },
    invoicing_legacy: { label: 'Legacy', tone: 'muted' },
  };
  return map[v] ?? { label: v || 'Unknown', tone: 'muted' };
};
const payment_state_label: ComputedFunction = (args) =>
  (payment_state(args) as { label: string }).label;
const payment_state_tone: ComputedFunction = (args) =>
  (payment_state(args) as { tone: string }).tone;

/**
 * Plain number formatting for monetary fields — deliberately WITHOUT a
 * currency symbol. currency_id is itself a many2one (same raw-ID-only
 * limitation as partner_id above), so guessing a symbol would risk
 * showing the wrong one. Args: { value: number }
 */
const format_amount: ComputedFunction = (args) => {
  const n = Number(args.value);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
};

/** YYYY-MM-DD (or false/empty) → a short display date, or '—'. Args: { value: string } */
const format_date: ComputedFunction = (args) => {
  const raw = args.value;
  if (!raw || typeof raw !== 'string') return '—';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
};

/** True when a due date is in the past (for an overdue indicator). Args: { value: string } */
const is_overdue: ComputedFunction = (args) => {
  const raw = args.value;
  if (!raw || typeof raw !== 'string') return false;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
};

/**
 * Odoo returns `false` (a boolean, not an empty string) for an unset char
 * field — e.g. { "phone": false }. Joins whichever of email/phone are
 * genuinely set with " · "; "—" if neither is. Args: { email, phone }
 */
const contact_meta: ComputedFunction = (args) => {
  const parts = [args.email, args.phone]
    .filter((v) => typeof v === 'string' && v.trim().length > 0)
    .map((v) => String(v).trim());
  return parts.length > 0 ? parts.join(' · ') : '—';
};

/** res.partner.is_company → a tone that distinguishes companies from people. Args: { value: boolean } */
const contact_tone: ComputedFunction = (args) => {
  return args.value ? 'accent' : 'success';
};

/**
 * mySMB's own Odoo company timezone (confirmed live via
 * ai_tool_mcp_retrieve_initial_context: Asia/Manila). calendar.event's
 * `start`/`stop` come back as naive UTC datetime strings — standard Odoo
 * API behavior; timezone conversion is normally a web-client-only concern.
 * Hardcoding this one IANA zone is only safe because this plugin targets
 * exactly one company's own instance, not a generic multi-tenant Odoo
 * connection.
 */
const ODOO_DISPLAY_TZ = 'Asia/Manila';

/** "YYYY-MM-DD HH:MM:SS" (naive UTC, Odoo's datetime wire format) → Date, or null. */
function parseOdooUtc(raw: unknown): Date | null {
  if (!raw || typeof raw !== 'string') return null;
  const d = new Date(`${raw.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function manilaDateKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: ODOO_DISPLAY_TZ }).format(d);
}

/** calendar.event.start/stop → {label, tone} — "Today"/"Tomorrow" get their own color, a later date is neutral. */
const event_day: ComputedFunction = (args) => {
  const d = parseOdooUtc(args.value);
  if (!d) return { label: '—', tone: 'muted' };
  const now = new Date();
  if (manilaDateKey(d) === manilaDateKey(now)) return { label: 'Today', tone: 'accent' };
  if (manilaDateKey(d) === manilaDateKey(new Date(now.getTime() + 86_400_000))) return { label: 'Tomorrow', tone: 'info' };
  return {
    label: d.toLocaleDateString('en-AU', { timeZone: ODOO_DISPLAY_TZ, day: 'numeric', month: 'short' }),
    tone: 'muted',
  };
};
const event_day_label: ComputedFunction = (args) => (event_day(args) as { label: string }).label;
const event_day_tone: ComputedFunction = (args) => (event_day(args) as { tone: string }).tone;

/** calendar.event.start/stop → "1:30 pm", in mySMB's own timezone. Args: { value: string } */
const event_time_label: ComputedFunction = (args) => {
  const d = parseOdooUtc(args.value);
  if (!d) return '—';
  return d
    .toLocaleTimeString('en-AU', { timeZone: ODOO_DISPLAY_TZ, hour: 'numeric', minute: '2-digit', hour12: true })
    .toLowerCase();
};

/** calendar.event.show_as → {label, tone}. Args: { value: string } */
const show_as: ComputedFunction = (args) => {
  const v = String(args.value ?? '');
  const map: Record<string, { label: string; tone: string }> = {
    busy: { label: 'Busy', tone: 'warning' },
    free: { label: 'Available', tone: 'success' },
  };
  return map[v] ?? { label: 'Unknown', tone: 'muted' };
};
const show_as_label: ComputedFunction = (args) => (show_as(args) as { label: string }).label;
const show_as_tone: ComputedFunction = (args) => (show_as(args) as { tone: string }).tone;

/**
 * Keeps only events that haven't ended yet, preserving the server's own
 * order. Odoo's domain is a single Python-literal string (see the file
 * header), so "upcoming" can't be expressed as a `start >= today` filter
 * using the host's `$today`-style param tokens — those only substitute a
 * param whose ENTIRE value is one token, not a piece embedded in a larger
 * domain string. Filtering client-side after a plain `[]` fetch sidesteps
 * that; args: { value: array }
 */
const filter_upcoming: ComputedFunction = (args) => {
  const list = Array.isArray(args.value) ? args.value : [];
  const now = Date.now();
  return list.filter((ev) => {
    const rec = ev as { start?: unknown; stop?: unknown };
    const end = parseOdooUtc(rec.stop) ?? parseOdooUtc(rec.start);
    return end ? end.getTime() >= now : true;
  });
};

/**
 * Deep link to this event's own record in Odoo's web client (new tab).
 * Confirmed live that `/odoo/calendar/<id>` returns 200 rather than 404 —
 * that only proves the route exists, not that it lands exactly on this
 * event's form (that page sits behind a login this plugin has no way to
 * check headlessly). Args: { id: number }
 */
const event_url: ComputedFunction = (args) => `https://mysmb.odoo.com/odoo/calendar/${args.id}`;

const elements: PluginElementsModule = {
  slug: 'odoo',
  functions: {
    contact_meta,
    contact_tone,
    sale_order_state_label,
    sale_order_state_tone,
    move_state_label,
    payment_state_label,
    payment_state_tone,
    format_amount,
    format_date,
    is_overdue,
    event_day_label,
    event_day_tone,
    event_time_label,
    show_as_label,
    show_as_tone,
    filter_upcoming,
    event_url,
  },
};

export default elements;
