import type { ComputedFunction, PluginElementsModule } from './types';

type AnyRecord = Record<string, unknown>;

/** Status groups the Open Job Openings Tracker shows, in row and bar order. */
const GROUPS = [
  { id: 'active', label: 'Active', tone: 'brand' },
  // `warning` renders brown in solid fills, so amber comes from `chart-3`.
  { id: 'onHold', label: 'On Hold', tone: 'chart-3' },
  { id: 'closed', label: 'Closed', tone: 'muted' },
] as const;

type GroupId = (typeof GROUPS)[number]['id'];

/** Recruit `Job_Opening_Status` picklist values, by group. Anything else counts as Active. */
const STATUS_GROUP: Record<string, GroupId> = {
  'in-progress': 'active',
  'waiting for approval': 'active',
  'submitted by client': 'active',
  'on-hold': 'onHold',
  filled: 'closed',
  cancelled: 'closed',
  declined: 'closed',
  inactive: 'closed',
};

/** Badge tones for the job list (text tones, so `warning` is fine here). */
const GROUP_BADGE_TONE: Record<GroupId, string> = { active: 'brand', onHold: 'warning', closed: 'muted' };

const MAX_JOB_ROWS = 20;
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Year and 0-based month an opening was opened: `Date_Opened` (YYYY-MM-DD), else `Created_Time`. */
function openedMonth(j: AnyRecord): { y: number; m: number; d: number } | null {
  const opened = String(j.Date_Opened ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (opened) return { y: Number(opened[1]), m: Number(opened[2]) - 1, d: Number(opened[3]) };
  const created = new Date(String(j.Created_Time ?? ''));
  if (Number.isNaN(created.getTime())) return null;
  return { y: created.getFullYear(), m: created.getMonth(), d: created.getDate() };
}

/** Lookup fields come back as `{ name, id }`; plain text as a string. */
function lookupName(v: unknown): string {
  if (v && typeof v === 'object') return String((v as AnyRecord).name ?? '').trim();
  return String(v ?? '').trim();
}

/**
 * Display-ready state for the Open Job Openings Tracker, from `list_records`
 * on `JobOpenings`. Groups every opening as Active, On Hold or Closed, sizes
 * the split bar from those counts, and compares openings opened this month
 * with last month (Recruit keeps no history of past active counts).
 * `selected` is the status group whose openings show under its row.
 *
 * Spec: `{ "$computed": "zoho-recruit_job_openings_dashboard", "args": { "report": { "$state": "/zoho-recruit/list_records" }, "showList": { "$state": "/ui/showAllJobs" }, "selected": { "$state": "/ui/jobsGroup" } } }`
 */
const job_openings_dashboard: ComputedFunction = (args) => {
  const report = (args.report && typeof args.report === 'object' ? args.report : {}) as AnyRecord;
  const loaded = Array.isArray(report.data);
  const jobs = loaded ? (report.data as AnyRecord[]) : [];
  const groupOf = (j: AnyRecord): GroupId => STATUS_GROUP[String(j?.Job_Opening_Status ?? '').trim().toLowerCase()] ?? 'active';
  const counts: Record<GroupId, number> = { active: 0, onHold: 0, closed: 0 };
  for (const j of jobs) counts[groupOf(j)] += 1;
  const total = jobs.length;

  const now = new Date();
  const thisY = now.getFullYear();
  const thisM = now.getMonth();
  const lastY = thisM === 0 ? thisY - 1 : thisY;
  const lastM = thisM === 0 ? 11 : thisM - 1;
  let openedThis = 0;
  let openedLast = 0;
  for (const j of jobs) {
    const o = openedMonth(j);
    if (o?.y === thisY && o.m === thisM) openedThis += 1;
    else if (o?.y === lastY && o.m === lastM) openedLast += 1;
  }
  const delta = openedThis - openedLast;

  const showList = args.showList === true;
  const selected = typeof args.selected === 'string' ? args.selected : '';
  const toItem = (j: AnyRecord) => {
    const group = groupOf(j);
    const o = openedMonth(j);
    const where = [lookupName(j.Client_Name), lookupName(j.City)].filter(Boolean).join(' · ');
    const opened = o ? `Opened ${String(o.d).padStart(2, '0')}-${MONTH_ABBR[o.m]}-${String(o.y).slice(-2)}` : '';
    return {
      id: String(j.id ?? ''),
      title: String(j.Posting_Title ?? j.Job_Opening_Name ?? '').trim() || '(Untitled opening)',
      detail: [where, opened].filter(Boolean).join(' · '),
      status: String(j.Job_Opening_Status ?? '').trim() || GROUPS.find((g) => g.id === group)!.label,
      tone: GROUP_BADGE_TONE[group],
    };
  };
  const jobList = jobs.slice(0, MAX_JOB_ROWS).map(toItem);
  // Openings of the clicked status row, shown under that row.
  const inGroup = selected ? jobs.filter((j) => groupOf(j) === selected) : [];
  const groupJobs = inGroup.slice(0, MAX_JOB_ROWS).map(toItem);
  const more = (report.info as AnyRecord | undefined)?.more_records === true;

  return {
    loaded,
    hasData: total > 0,
    activeCount: counts.active,
    onHoldCount: counts.onHold,
    closedCount: counts.closed,
    activeDisplay: counts.active.toLocaleString('en-US'),
    activeLabel: counts.active === 1 ? 'active opening' : 'active openings',
    deltaDisplay: delta === 0 ? 'No change' : `${delta > 0 ? '+' : ''}${delta.toLocaleString('en-US')}`,
    deltaIcon: delta > 0 ? 'ArrowUp' : delta < 0 ? 'ArrowDown' : 'Minus',
    deltaTone: delta > 0 ? 'success' : delta < 0 ? 'destructive' : 'muted',
    // Split bar: one `fr` column per non-empty group, sized by its count.
    barTemplate: GROUPS.filter((g) => counts[g.id] > 0)
      .map((g) => `${counts[g.id]}fr`)
      .join(' '),
    rows: GROUPS.map((g) => ({
      id: g.id,
      label: g.label,
      tone: g.tone,
      countDisplay: counts[g.id].toLocaleString('en-US'),
      expanded: g.id === selected,
      chevron: g.id === selected ? 'ChevronUp' : 'ChevronDown',
      // What a click on this row writes to `/ui/jobsGroup`.
      toggle: g.id === selected ? '' : g.id,
    })),
    groupJobs,
    groupEmpty: !!selected && groupJobs.length === 0,
    groupNote:
      inGroup.length > groupJobs.length
        ? `Showing ${groupJobs.length} of ${inGroup.length.toLocaleString('en-US')} job openings, newest first.`
        : '',
    capNote: more ? `Based on the newest ${total.toLocaleString('en-US')} job openings.` : '',
    totalDisplay: total.toLocaleString('en-US'),
    listExpanded: showList,
    // What a click on the total writes to `/ui/showAllJobs`.
    listToggle: !showList,
    listChevron: showList ? 'ChevronUp' : 'ChevronDown',
    jobList,
    listNote:
      showList && total > jobList.length
        ? `Showing ${jobList.length} of ${total.toLocaleString('en-US')} job openings, newest first.`
        : '',
  };
};

const elements: PluginElementsModule = {
  slug: 'zoho-recruit',
  functions: {
    job_openings_dashboard,
  },
  actions: {},
};

export default elements;
