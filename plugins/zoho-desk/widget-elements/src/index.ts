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

/** Most tickets the Priority Breakdown tile reads (`list_tickets` max). */
const PRIORITY_TICKET_CAP = 100;

/** Priority rows, in order. Medium's bar is `chart-3` because `warning` renders brown in solid fills. */
const PRIORITIES = [
  { id: 'high', label: 'High', tone: 'destructive' },
  { id: 'medium', label: 'Medium', tone: 'chart-3' },
  { id: 'low', label: 'Low', tone: 'success' },
] as const;

/**
 * Display-ready state for the Priority Breakdown tile, from `list_tickets`
 * with `status: "${OPEN}"` (Open and Escalated, not On Hold or Closed).
 * High, Medium and Low always show; a "No priority" row appears only when a
 * ticket has none (or one outside those three), so the rows add up to the total.
 *
 * Spec: `{ "$computed": "zoho-desk_priority_breakdown_dashboard", "args": { "report": { "$state": "/zoho-desk/list_tickets" }, "showList": { "$state": "/ui/showPriorityTickets" }, "showHigh": { "$state": "/ui/showHighTickets" } } }`
 */
const priority_breakdown_dashboard: ComputedFunction = (args) => {
  const report = (args.report && typeof args.report === 'object' ? args.report : {}) as AnyRecord;
  const loaded = Array.isArray(report.data);
  const tickets = loaded ? (report.data as AnyRecord[]) : [];
  const counts: Record<string, number> = {};
  for (const t of tickets) {
    const p = String(t?.priority ?? '').trim().toLowerCase();
    const id = PRIORITIES.some((x) => x.id === p) ? p : 'none';
    counts[id] = (counts[id] ?? 0) + 1;
  }
  const total = tickets.length;
  const pct = (n: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
  const rows: AnyRecord[] = PRIORITIES.map((x) => ({
    id: x.id,
    label: x.label,
    tone: x.tone,
    pct: pct(counts[x.id] ?? 0),
    countDisplay: (counts[x.id] ?? 0).toLocaleString('en-US'),
  }));
  if (counts.none) {
    rows.push({ id: 'none', label: 'No priority', tone: 'default', pct: pct(counts.none), countDisplay: counts.none.toLocaleString('en-US') });
  }
  const high = counts.high ?? 0;
  // Ticket list under the total, newest first (the provider sorts by -createdTime).
  const showList = args.showList === true;
  const toItem = (t: AnyRecord) => {
    const status = String(t.status ?? '').trim() || 'Unknown';
    return {
      id: String(t.id ?? t.ticketNumber),
      number: `#${String(t.ticketNumber ?? '')}`,
      subject: String(t.subject ?? '').trim() || '(No subject)',
      status,
      tone: STATUS_TONE[status.toLowerCase()] ?? 'muted',
    };
  };
  const ticketList = tickets.slice(0, MAX_TICKET_ROWS).map(toItem);
  // High-priority tickets under the callout.
  const showHigh = args.showHigh === true;
  const highList = tickets
    .filter((t) => String(t?.priority ?? '').trim().toLowerCase() === 'high')
    .slice(0, MAX_TICKET_ROWS)
    .map(toItem);
  return {
    highExpanded: showHigh,
    // What a click on the callout writes to `/ui/showHighTickets`.
    highToggle: !showHigh,
    highChevron: showHigh ? 'ChevronUp' : 'ChevronDown',
    highList,
    highNote:
      showHigh && high > highList.length
        ? `Showing ${highList.length} of ${high.toLocaleString('en-US')} high-priority tickets, newest first.`
        : '',
    loaded,
    hasData: total > 0,
    rows,
    listExpanded: showList,
    // What a click on the total writes to `/ui/showPriorityTickets`.
    listToggle: !showList,
    listChevron: showList ? 'ChevronUp' : 'ChevronDown',
    ticketList,
    listNote:
      showList && total > ticketList.length
        ? `Showing ${ticketList.length} of ${total.toLocaleString('en-US')} tickets, newest first.`
        : '',
    highCount: high,
    alertText: `${high.toLocaleString('en-US')} high-priority ${high === 1 ? 'ticket needs' : 'tickets need'} attention first`,
    totalLabel: `${total.toLocaleString('en-US')} open ${total === 1 ? 'ticket' : 'tickets'} total`,
    capNote: total >= PRIORITY_TICKET_CAP ? `Based on the newest ${PRIORITY_TICKET_CAP} open tickets.` : '',
  };
};

const HOUR_MS = 60 * 60 * 1000;

/** Heading over the list a clicked SLA card opens. */
const GROUP_TITLES: Record<string, string> = {
  overdue: 'Overdue tickets',
  soon: 'Due within 1 hr',
  today: 'On track today',
};
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Local `5:33 pm`. */
function clockTime(d: Date): string {
  const h = d.getHours() % 12 || 12;
  return `${h}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'am' : 'pm'}`;
}

/** Local `11-Nov-26` (TILE-DISPLAY-STANDARDS §1). */
function ddMmmYy(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}-${MONTH_ABBR[d.getMonth()]}-${String(d.getFullYear()).slice(2)}`;
}

/**
 * Display-ready state for the SLA & Due Date Health tile, from `list_tickets`
 * with `status: "${OPEN},${ONHOLD}"` sorted by `dueDate`. Against the
 * current local time: overdue (due date passed), due within 1 hr, and
 * "on track today" (due later today, more than an hour away). On Hold
 * tickets have no due date (Desk pauses the clock), so they count only
 * towards the total.
 *
 * Spec: `{ "$computed": "zoho-desk_sla_due_dashboard", "args": { "report": { "$state": "/zoho-desk/list_tickets" }, "showList": { "$state": "/ui/showSlaTickets" }, "selected": { "$state": "/ui/slaCard" }, "showNearest": { "$state": "/ui/showNearest" } } }`
 */
const sla_due_dashboard: ComputedFunction = (args) => {
  const report = (args.report && typeof args.report === 'object' ? args.report : {}) as AnyRecord;
  const loaded = Array.isArray(report.data);
  const tickets = loaded ? (report.data as AnyRecord[]) : [];
  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const tomorrowEnd = new Date(endOfToday);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

  let overdue = 0;
  let soon = 0;
  let today = 0;
  let nearest: { subject: string; due: Date; ticket: AnyRecord } | null = null;
  const items = tickets.map((t) => {
    const raw = typeof t.dueDate === 'string' ? Date.parse(t.dueDate) : NaN;
    const due = Number.isNaN(raw) ? null : new Date(raw);
    const subject = String(t.subject ?? '').trim() || '(No subject)';
    let dueLabel: string;
    let dueTone: string;
    let rank: number;
    let group = '';
    if (!due) {
      const onHold = String(t.status ?? '').trim().toLowerCase() === 'on hold';
      dueLabel = onHold ? 'On hold' : 'No due date';
      dueTone = 'muted';
      rank = Number.MAX_SAFE_INTEGER;
    } else {
      rank = due.getTime();
      if (due.getTime() < now.getTime()) {
        overdue += 1;
        group = 'overdue';
        dueLabel = 'Overdue';
        dueTone = 'destructive';
      } else {
        if (!nearest || due < nearest.due) nearest = { subject, due, ticket: t };
        if (due.getTime() - now.getTime() <= HOUR_MS) {
          soon += 1;
          group = 'soon';
          dueLabel = 'Due in 1 hr';
          dueTone = 'warning';
        } else if (due <= endOfToday) {
          today += 1;
          group = 'today';
          dueLabel = 'Due today';
          dueTone = 'brand';
        } else {
          dueLabel = due <= tomorrowEnd ? 'Due tomorrow' : `Due ${ddMmmYy(due)}`;
          dueTone = 'muted';
        }
      }
    }
    return {
      id: String(t.id ?? t.ticketNumber),
      number: `#${String(t.ticketNumber ?? '')}`,
      subject,
      dueLabel,
      dueTone,
      rank,
      group,
    };
  });
  items.sort((a, b) => a.rank - b.rank);
  const total = tickets.length;
  const showList = args.showList === true;
  const strip = ({ rank: _rank, group: _group, ...rest }: (typeof items)[number]) => rest;
  const ticketList = items.slice(0, MAX_TICKET_ROWS).map(strip);

  // The card whose tickets are listed under the cards (`/ui/slaCard`), or none.
  const selected = typeof args.selected === 'string' && GROUP_TITLES[args.selected] ? args.selected : '';
  const inGroup = selected ? items.filter((x) => x.group === selected) : [];
  const groupList = inGroup.slice(0, MAX_TICKET_ROWS).map(strip);
  const toggle = (key: string) => (selected === key ? '' : key);
  const chevron = (key: string) => (selected === key ? 'ChevronUp' : 'ChevronDown');

  let nearestText = '';
  const n = nearest as { subject: string; due: Date; ticket: AnyRecord } | null;
  if (n) {
    const when =
      n.due <= endOfToday
        ? `due today, ${clockTime(n.due)}`
        : n.due <= tomorrowEnd
          ? `due tomorrow, ${clockTime(n.due)}`
          : `due ${ddMmmYy(n.due)}`;
    nearestText = `Nearest due: “${n.subject}” — ${when}`;
  }
  // Details under the nearest-due line when it is clicked (`/ui/showNearest`).
  const showNearest = args.showNearest === true && n !== null;
  const nearestStatus = n ? String(n.ticket.status ?? '').trim() || 'Unknown' : '';
  const nearestPriority = n ? String(n.ticket.priority ?? '').trim() : '';

  return {
    loaded,
    hasData: total > 0,
    overdueDisplay: overdue.toLocaleString('en-US'),
    overdueLabel: `overdue ${overdue === 1 ? 'ticket' : 'tickets'}`,
    overdueTone: overdue > 0 ? 'destructive' : 'success',
    overdueIcon: overdue > 0 ? 'TriangleAlert' : 'CircleCheck',
    soonDisplay: soon.toLocaleString('en-US'),
    todayDisplay: today.toLocaleString('en-US'),
    nearestText,
    nearestExpanded: showNearest,
    // What a click on the nearest-due line writes to `/ui/showNearest`.
    nearestToggle: !showNearest,
    nearestChevron: showNearest ? 'ChevronUp' : 'ChevronDown',
    nearestNumber: n ? `#${String(n.ticket.ticketNumber ?? '')}` : '',
    nearestStatus,
    nearestStatusTone: STATUS_TONE[nearestStatus.toLowerCase()] ?? 'muted',
    nearestDetail: n
      ? [nearestPriority ? `${nearestPriority} priority` : 'No priority', `Due ${ddMmmYy(n.due)}, ${clockTime(n.due)}`].join(' · ')
      : '',
    overdueToggle: toggle('overdue'),
    soonToggle: toggle('soon'),
    todayToggle: toggle('today'),
    overdueChevron: chevron('overdue'),
    soonChevron: chevron('soon'),
    todayChevron: chevron('today'),
    // Overdue lists inside its own (full-width) card; the two small cards share the box under the grid.
    overdueExpanded: selected === 'overdue',
    groupExpanded: selected === 'soon' || selected === 'today',
    groupTitle: GROUP_TITLES[selected] ?? '',
    groupList,
    groupEmpty: GROUP_TITLES[selected] !== undefined && inGroup.length === 0,
    groupNote:
      inGroup.length > groupList.length
        ? `Showing ${groupList.length} of ${inGroup.length.toLocaleString('en-US')} tickets, soonest due first.`
        : '',
    capNote: total >= PRIORITY_TICKET_CAP ? `Based on the ${PRIORITY_TICKET_CAP} tickets due soonest.` : '',
    totalLabel: `${total.toLocaleString('en-US')} active ${total === 1 ? 'ticket' : 'tickets'} total`,
    listExpanded: showList,
    // What a click on the total writes to `/ui/showSlaTickets`.
    listToggle: !showList,
    listChevron: showList ? 'ChevronUp' : 'ChevronDown',
    ticketList,
    listNote:
      showList && total > ticketList.length
        ? `Showing ${ticketList.length} of ${total.toLocaleString('en-US')} tickets, soonest due first.`
        : '',
  };
};

const elements: PluginElementsModule = {
  slug: 'zoho-desk',
  functions: {
    ticket_status_dashboard,
    ticket_list_chevron,
    priority_breakdown_dashboard,
    sla_due_dashboard,
  },
  actions: {
    toggle_ticket_list,
  },
};

export default elements;
