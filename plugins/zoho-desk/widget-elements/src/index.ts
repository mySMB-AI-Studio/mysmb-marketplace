import type { ComputedFunction, PluginElementsModule } from './types';

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
    // Beside "All Tickets": when the counts were read, and how many tickets there are in all.
    asOfLabel: `as of ${ddMmmYy(new Date())} · ${total.toLocaleString('en-US')} total`,
  };
  for (const s of STATUSES) {
    const n = counts[s.value] ?? 0;
    out[`${s.key}Display`] = n.toLocaleString('en-US');
  }
  return out;
};

/** Rows shown in the ticket list (TILE-DISPLAY-STANDARDS §11). */
const MAX_TICKET_ROWS = 20;

/** Status tones per TILE-DISPLAY-STANDARDS §7: open is in progress, closed is done. */
const STATUS_TONE: Record<string, string> = {
  open: 'info',
  'on hold': 'warning',
  escalated: 'destructive',
  closed: 'success',
};

/** Periods in the "Tickets over time" dropdown, in order. "This week" is the default, so its value is empty. */
const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: '', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'custom', label: 'Custom range' },
] as const;

/** Status filter on the "Tickets over time" ticket list. Values match Zoho's statuses, lowercased. */
const STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'on hold', label: 'On Hold' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'closed', label: 'Closed' },
] as const;

/** A status as a Title Case badge label, e.g. "on hold" → "On Hold". */
function statusLabel(status: string): string {
  const known = STATUS_FILTERS.find((s) => s.value && s.value === status.toLowerCase());
  return known ? known.label : status.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

/** Local midnight at the start of today, this week (Monday) and this month. */
function periodStarts(now: Date): { today: Date; week: Date; month: Date } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const week = new Date(today);
  week.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  return { today, week, month: new Date(now.getFullYear(), now.getMonth(), 1) };
}

/** A `DateInput` value (`YYYY-MM-DD`) as local midnight, or null. */
function localDay(value: unknown): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/**
 * `createdTimeRange` for the "Tickets over time" `search_tickets` call: from
 * the start of this week or this month, whichever is earlier, to now, so one
 * call covers today, this week and this month.
 *
 * Spec: `{ "$computed": "zoho-desk_ticket_created_range", "args": {} }`
 */
const ticket_created_range: ComputedFunction = () => {
  const now = new Date();
  const { week, month } = periodStarts(now);
  const from = week < month ? week : month;
  return `${from.toISOString()},${now.toISOString()}`;
};

/**
 * Display-ready state for the Ticket Status Overview tile's "Tickets over
 * time" section. Counts tickets created this month and in the selected period
 * and lists that period's tickets.
 *
 * - Today, this week and this month come from `search_tickets` over
 *   `ticket_created_range` (newest first; `{ data: [...], count }`).
 * - A custom range is read separately, through `passthrough_get` on
 *   `/tickets/search`, so "Total this month" keeps its own data. `customRange`
 *   is the range that call should use: set once both dates are valid and
 *   otherwise kept at its last value (`prevRange`), so the call never runs
 *   with an incomplete range.
 *
 * Args:
 *   search        — the `search_tickets` result
 *   custom        — the `passthrough_get` result for the custom range
 *   period        — `/ui/ticketPeriod`: 'today', '' (this week), 'month' or 'custom'
 *   from, to      — `/ui/ticketDates/from`, `/ui/ticketDates/to`: `YYYY-MM-DD`, both inclusive
 *   prevRange     — this function's previous `customRange`
 *   status        — `/ui/ticketStatusFilter`: '' (all) or a lowercase status, filters the ticket list
 *   listOpen      — true when the ticket list is open (`/ui/showTicketList`, opened by the filters and "Show list", closed by "Hide list")
 *
 * Spec: `{ "$computed": "zoho-desk_ticket_activity_dashboard", "args": { "search": { "$state": "/zoho-desk/search_tickets" }, "custom": { "$state": "/zoho-desk/passthrough_get" }, "period": { "$state": "/ui/ticketPeriod" }, "from": { "$state": "/ui/ticketDates/from" }, "to": { "$state": "/ui/ticketDates/to" }, "prevRange": { "$state": "/ui/ticketTime/customRange" }, "status": { "$state": "/ui/ticketStatusFilter" }, "listOpen": { "$state": "/ui/showTicketList" } } }`
 */
const ticket_activity_dashboard: ComputedFunction = (args) => {
  const search = (args.search && typeof args.search === 'object' ? args.search : {}) as AnyRecord;
  const custom = (args.custom && typeof args.custom === 'object' ? args.custom : {}) as AnyRecord;
  const loaded = Array.isArray(search.data);
  const searchRows = loaded ? (search.data as AnyRecord[]) : [];
  const now = new Date();
  const starts = periodStarts(now);
  const period = PERIODS.find((p) => p.value === args.period) ?? PERIODS[1];
  const isCustom = period.value === 'custom';

  // The custom range: the start of `from` to the end of `to`, both local days.
  const fromDay = localDay(args.from);
  const toDay = localDay(args.to);
  const toEnd = toDay ? new Date(toDay.getFullYear(), toDay.getMonth(), toDay.getDate() + 1) : null;
  const rangeValid = Boolean(fromDay && toEnd && fromDay < toEnd);
  const customRange =
    fromDay && toEnd && rangeValid
      ? `${fromDay.toISOString()},${new Date(toEnd.getTime() - 1).toISOString()}`
      : typeof args.prevRange === 'string'
        ? args.prevRange
        : undefined;
  const customHint =
    !fromDay || !toDay ? 'Choose a start and end date.' : !rangeValid ? 'The end date must be on or after the start date.' : '';

  const createdIn = (rows: AnyRecord[], from: Date, to?: Date | null) =>
    rows.filter((t) => {
      const ms = Date.parse(String(t.createdTime ?? ''));
      return Number.isFinite(ms) && ms >= from.getTime() && (!to || ms < to.getTime());
    });
  // Zoho's `count` covers the whole range it was asked for, including tickets
  // beyond the 100 read. It equals this month's total when the range starts on the 1st.
  const count = Number(search.count);
  const rangeIsMonth = starts.month <= starts.week;
  const monthRows = createdIn(searchRows, starts.month);
  const monthCount = rangeIsMonth && Number.isFinite(count) ? count : monthRows.length;
  const monthTruncated = !rangeIsMonth && monthRows.length === searchRows.length && Number(count) > searchRows.length;

  let inPeriod: AnyRecord[];
  let truncated: boolean;
  if (isCustom) {
    const rows = Array.isArray(custom.data) ? (custom.data as AnyRecord[]) : [];
    // Filtered to the dates on screen, so a result for the previous dates never shows.
    inPeriod = fromDay && rangeValid ? createdIn(rows, fromDay, toEnd) : [];
    truncated = rangeValid && Number(custom.count) > rows.length;
  } else {
    const since = period.value === 'today' ? starts.today : period.value === 'month' ? starts.month : starts.week;
    inPeriod = createdIn(searchRows, since);
    // Rows come newest first, so the period is only cut short when every row read falls inside it.
    truncated = inPeriod.length === searchRows.length && Number.isFinite(count) && count > searchRows.length;
  }

  const listOpen = args.listOpen === true && (!isCustom || rangeValid);
  const statusFilter = STATUS_FILTERS.find((s) => s.value === args.status) ?? STATUS_FILTERS[0];
  const shown = statusFilter.value
    ? inPeriod.filter((t) => String(t.status ?? '').trim().toLowerCase() === statusFilter.value)
    : inPeriod;
  const list = shown.slice(0, MAX_TICKET_ROWS).map((t) => {
    const status = String(t.status ?? '').trim() || 'Unknown';
    return {
      id: String(t.id ?? t.ticketNumber),
      number: `#${String(t.ticketNumber ?? '')}`,
      subject: String(t.subject ?? '').trim() || '(No subject)',
      status,
      label: statusLabel(status),
      tone: STATUS_TONE[status.toLowerCase()] ?? 'muted',
    };
  });
  const rangeLabel =
    fromDay && toDay && rangeValid
      ? args.from === args.to
        ? ddMmmYy(fromDay)
        : `${ddMmmYy(fromDay)} – ${ddMmmYy(toDay)}`
      : '';
  const statusWord = statusFilter.value ? `${statusFilter.label.toLowerCase()} ` : '';
  const periodName = isCustom
    ? args.from === args.to
      ? `on ${rangeLabel}`
      : `from ${rangeLabel.replace(' – ', ' to ')}`
    : period.label.toLowerCase();
  return {
    loaded,
    periodOptions: PERIODS.map((p) => ({ value: p.value, label: p.label })),
    monthDisplay: `${monthCount.toLocaleString('en-US')}${monthTruncated ? '+' : ''}`,
    isCustom,
    customRange,
    customHint: isCustom ? customHint : '',
    // Shows "Clear dates" once either date is set.
    hasDates: isCustom && Boolean(args.from || args.to),
    // The ticket list shows once the period has numbers to show.
    hasPeriod: !isCustom || rangeValid,
    list,
    statusOptions: STATUS_FILTERS.map((s) => ({ value: s.value, label: s.label })),
    listExpanded: listOpen,
    // "Show list" reopens the list after "Hide list" (preset periods; a custom range always offers "Hide list").
    listHidden: !listOpen && !isCustom,
    listEmpty: listOpen && list.length === 0,
    // Shown beside "Hide list": tickets matching the period and status.
    shownCount: `${shown.length.toLocaleString('en-US')}${truncated ? '+' : ''} ${shown.length === 1 && !truncated ? 'ticket' : 'tickets'}`,
    emptyText: `No ${statusWord}tickets created ${periodName}.`,
    note:
      listOpen && (shown.length > list.length || truncated)
        ? `Showing ${list.length} of ${shown.length.toLocaleString('en-US')}${truncated ? '+' : ''} ${statusWord}tickets created ${periodName}, newest first.`
        : '',
  };
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

const MAX_AGENT_ROWS = 20;

/**
 * Display-ready state for the Agent Workload tile, from `agent_workload`
 * (active agents with open + on-hold counts and their active tickets).
 * Busiest agents first, then by name; `selected` is the agent id whose
 * tickets show under that agent's row (a click on the same row closes it).
 *
 * Spec: `{ "$computed": "zoho-desk_agent_workload_dashboard", "args": { "report": { "$state": "/zoho-desk/agent_workload" }, "selected": { "$state": "/ui/workloadAgent" }, "showList": { "$state": "/ui/showWorkloadTickets" } } }`
 */
const agent_workload_dashboard: ComputedFunction = (args) => {
  const report = (args.report && typeof args.report === 'object' ? args.report : {}) as AnyRecord;
  const loaded = Array.isArray(report.agents);
  const agents = loaded ? (report.agents as AnyRecord[]) : [];
  const selected = typeof args.selected === 'string' ? args.selected : '';
  const sorted = agents
    .map((a) => ({ a, count: Number(a?.activeCount) || 0, name: String(a?.name ?? '').trim() || String(a?.emailId ?? '') }))
    .sort((x, y) => y.count - x.count || x.name.localeCompare(y.name));
  const total = sorted.reduce((sum, x) => sum + x.count, 0);
  const rows = sorted.slice(0, MAX_AGENT_ROWS).map(({ a, count, name }) => {
    const id = String(a.id ?? name);
    const confirmed = a.isConfirmed !== false;
    const online = confirmed && a.isOnline === true;
    const role = String(a.roleName ?? '').trim();
    const presence = online ? 'Online' : 'Offline';
    // First and last word, so "Sean Matthew Baker" is SB.
    const words = name.split(/\s+/).filter(Boolean);
    const initials =
      (words.length > 1 ? [words[0]!, words[words.length - 1]!] : words).map((w) => w[0]!.toUpperCase()).join('') || '?';
    const busy = confirmed && count > 0;
    return {
      id,
      name: name || 'Unnamed agent',
      initials,
      detail: confirmed ? (role ? `${presence} · ${role}` : presence) : 'Invite pending',
      dotTone: online ? 'success' : 'muted',
      avatarTone: busy ? 'brand' : 'muted',
      countDisplay: count.toLocaleString('en-US'),
      countTone: busy ? 'brand' : 'muted',
      // Shows this agent's ticket panel right under the row.
      expanded: id === selected,
      chevron: id === selected ? 'ChevronUp' : 'ChevronDown',
      // What a click on this row writes to `/ui/workloadAgent`.
      toggle: id === selected ? '' : id,
    };
  });
  const pick = selected ? sorted.find((x) => String(x.a.id ?? x.name) === selected) : undefined;
  const pickTickets = pick && Array.isArray(pick.a.tickets) ? (pick.a.tickets as AnyRecord[]) : [];
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
  const selectedTickets = pickTickets.slice(0, MAX_TICKET_ROWS).map(toItem);
  const pickCount = pick ? pick.count : 0;
  // Every agent's tickets under the total, newest (highest number) first.
  const showList = args.showList === true;
  const allTickets = sorted
    .flatMap((x) => (Array.isArray(x.a.tickets) ? (x.a.tickets as AnyRecord[]) : []))
    .sort((x, y) => (Number(y.ticketNumber) || 0) - (Number(x.ticketNumber) || 0));
  const ticketList = allTickets.slice(0, MAX_TICKET_ROWS).map(toItem);
  return {
    loaded,
    hasData: agents.length > 0,
    agents: rows,
    agentNote:
      agents.length > rows.length ? `Showing ${rows.length} of ${agents.length.toLocaleString('en-US')} agents, busiest first.` : '',
    selectedTickets,
    selectedEmpty: !!pick && selectedTickets.length === 0,
    selectedNote:
      pick && (pickCount > selectedTickets.length || report.ticketsTruncated === true) && selectedTickets.length > 0
        ? `Showing ${selectedTickets.length} of ${pickCount.toLocaleString('en-US')} tickets, newest first.`
        : '',
    listExpanded: showList,
    // What a click on the total writes to `/ui/showWorkloadTickets`.
    listToggle: !showList,
    listChevron: showList ? 'ChevronUp' : 'ChevronDown',
    ticketList,
    listEmpty: showList && ticketList.length === 0,
    listNote:
      showList && ticketList.length > 0 && (total > ticketList.length || report.ticketsTruncated === true)
        ? `Showing ${ticketList.length} of ${total.toLocaleString('en-US')} tickets, newest first.`
        : '',
    totalLabel: `${total.toLocaleString('en-US')} active ${total === 1 ? 'ticket' : 'tickets'} total`,
  };
};

const elements: PluginElementsModule = {
  slug: 'zoho-desk',
  functions: {
    ticket_status_dashboard,
    ticket_created_range,
    ticket_activity_dashboard,
    priority_breakdown_dashboard,
    sla_due_dashboard,
    agent_workload_dashboard,
  },
};

export default elements;
