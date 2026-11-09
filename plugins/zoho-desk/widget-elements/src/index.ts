import type { ComputedFunction, PluginElementsModule, PluginWidgetActionContext } from './types';

type AnyRecord = Record<string, unknown>;

/** The statuses the Ticket Status Overview tile shows, in card order. */
const STATUSES = [
  { key: 'open', value: 'open' },
  { key: 'onHold', value: 'on hold' },
  { key: 'escalated', value: 'escalated' },
  { key: 'closed', value: 'closed' },
] as const;

/**
 * Display-ready state for the Ticket Status Overview tile, from
 * `tickets_count_by_field` with `field: "status"`, which returns
 * `{ status: [{ value: "open", count: "3" }, ...] }` (counts are strings,
 * values lowercase). Statuses other than the four shown still count towards
 * the total.
 *
 * Spec: `{ "$computed": "zoho-desk_ticket_status_dashboard", "args": { "report": { "$state": "/zoho-desk/tickets_count_by_field" } } }`
 */
const ticket_status_dashboard: ComputedFunction = (args) => {
  const report = (args.report && typeof args.report === 'object' ? args.report : {}) as AnyRecord;
  const loaded = Array.isArray(report.status);
  const counts: Record<string, number> = {};
  let total = 0;
  for (const row of loaded ? (report.status as AnyRecord[]) : []) {
    const n = Number(row?.count) || 0;
    const value = String(row?.value ?? '').trim().toLowerCase();
    counts[value] = (counts[value] ?? 0) + n;
    total += n;
  }

  const out: AnyRecord = {
    loaded,
    hasData: total > 0,
    total,
    totalLabel: `${total.toLocaleString('en-US')} ${total === 1 ? 'ticket' : 'tickets'} total`,
  };
  for (const s of STATUSES) {
    const n = counts[s.value] ?? 0;
    out[`${s.key}Display`] = n.toLocaleString('en-US');
    // Share of all tickets, for the bar on each card.
    out[`${s.key}Pct`] = total > 0 ? Math.round((n / total) * 100) : 0;
  }
  return out;
};

/** Rows shown in the ticket list (TILE-DISPLAY-STANDARDS §11). */
const MAX_TICKET_ROWS = 20;

const STATUS_TONE: Record<string, string> = {
  open: 'brand',
  'on hold': 'warning',
  escalated: 'destructive',
};

/** `ChevronUp` while the ticket list is open, else `ChevronDown`. */
const ticket_list_chevron: ComputedFunction = (args) => (args.expanded === true ? 'ChevronUp' : 'ChevronDown');

/**
 * Shows or hides the ticket list under the total. The first open fetches the
 * newest tickets with `list_tickets`; later toggles reuse them. Writes
 * `/ui/tickets/{expanded,loading,error,list,note}`.
 *
 * Spec: `{ "action": "zoho-desk_toggle_ticket_list", "params": {} }`
 */
async function toggleTicketList(_params: Record<string, unknown>, ctx: PluginWidgetActionContext): Promise<void> {
  const store = ctx.store;
  if (!store) return;
  const expanded = store.get('/ui/tickets/expanded') !== true;
  store.set('/ui/tickets/expanded', expanded);
  if (!expanded || Array.isArray(store.get('/ui/tickets/list')) || store.get('/ui/tickets/loading') === true) return;

  store.set('/ui/tickets/loading', true);
  store.set('/ui/tickets/error', '');
  try {
    const res = await fetch('/api/widgets-system/call-tool', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mcp: 'zoho-desk',
        tool: 'list_tickets',
        params: { limit: MAX_TICKET_ROWS, sortBy: '-createdTime' },
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { data?: { data?: AnyRecord[] } };
    const tickets = Array.isArray(body.data?.data) ? body.data!.data! : [];
    const list = tickets.map((t) => {
      const status = String(t.status ?? '').trim() || 'Unknown';
      return {
        id: String(t.id ?? t.ticketNumber),
        number: `#${String(t.ticketNumber ?? '')}`,
        subject: String(t.subject ?? '').trim() || '(No subject)',
        status,
        tone: STATUS_TONE[status.toLowerCase()] ?? 'muted',
      };
    });
    const total = Number(store.get('/ui/ticketStatus/total')) || 0;
    store.set(
      '/ui/tickets/note',
      total > list.length ? `Showing ${list.length} of ${total.toLocaleString('en-US')} tickets, newest first.` : '',
    );
    store.set('/ui/tickets/list', list);
  } catch {
    store.set('/ui/tickets/error', "Couldn't load the tickets. Please try again.");
  } finally {
    store.set('/ui/tickets/loading', false);
  }
}

const toggle_ticket_list = {
  description: 'Show or hide the newest Zoho Desk tickets (up to 20) under the ticket total, fetching them on first open.',
  schema: { type: 'object', properties: {} } as const,
  handler: toggleTicketList,
};

const elements: PluginElementsModule = {
  slug: 'zoho-desk',
  functions: {
    ticket_status_dashboard,
    ticket_list_chevron,
  },
  actions: {
    toggle_ticket_list,
  },
};

export default elements;
