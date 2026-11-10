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

/** Pipeline rows, in order, with the Recruit `Candidate_Stage` values each one groups. Rejected is left out. */
const PIPELINE_STAGES = [
  { id: 'new', label: 'New', tone: 'brand', badgeTone: 'brand', stages: ['new'] },
  { id: 'screening', label: 'Screening', tone: 'chart-5', badgeTone: 'brand', stages: ['in review', 'available'] },
  { id: 'interview', label: 'Interview', tone: 'chart-2', badgeTone: 'brand', stages: ['engaged'] },
  { id: 'offer', label: 'Offer', tone: 'success', badgeTone: 'success', stages: ['offered'] },
  { id: 'hired', label: 'Hired', tone: 'success', badgeTone: 'success', stages: ['hired'] },
] as const;

const MAX_CANDIDATE_ROWS = 20;

/** `/ui/pipelineStage` value for the hired list under "Conversion to Hired" (separate from the Hired row). */
const CONVERSION = 'conversion';

/**
 * Display-ready state for the Candidate Pipeline by Stage tile, from
 * `list_records` on `Candidates`. Groups candidates by `Candidate_Stage`,
 * sizes each bar against the biggest stage, works out the conversion to
 * hired, and compares candidates added this month with last month.
 * `selected` is a stage id (its candidates show under its row) or
 * `"conversion"` (hired candidates show under the conversion line).
 *
 * Spec: `{ "$computed": "zoho-recruit_candidate_pipeline_dashboard", "args": { "report": { "$state": "/zoho-recruit/list_records" }, "selected": { "$state": "/ui/pipelineStage" } } }`
 */
const candidate_pipeline_dashboard: ComputedFunction = (args) => {
  const report = (args.report && typeof args.report === 'object' ? args.report : {}) as AnyRecord;
  const loaded = Array.isArray(report.data);
  const all = loaded ? (report.data as AnyRecord[]) : [];
  const selected = typeof args.selected === 'string' ? args.selected : '';
  const stageOf = (c: AnyRecord) => {
    const s = String(c?.Candidate_Stage ?? '').trim().toLowerCase();
    return PIPELINE_STAGES.find((p) => (p.stages as readonly string[]).includes(s));
  };
  const inPipeline = all.filter((c) => stageOf(c));
  const total = inPipeline.length;
  const counts: Record<string, number> = {};
  for (const c of inPipeline) counts[stageOf(c)!.id] = (counts[stageOf(c)!.id] ?? 0) + 1;
  const max = Math.max(0, ...Object.values(counts));
  const hired = counts.hired ?? 0;

  // Added this month vs last month, by the date part of `Created_Time` (Recruit's org time).
  const now = new Date();
  const thisKey = now.getFullYear() * 12 + now.getMonth();
  let addedThis = 0;
  let addedLast = 0;
  for (const c of all) {
    const m = String(c.Created_Time ?? '').match(/^(\d{4})-(\d{2})/);
    if (!m) continue;
    const key = Number(m[1]) * 12 + Number(m[2]) - 1;
    if (key === thisKey) addedThis += 1;
    else if (key === thisKey - 1) addedLast += 1;
  }
  const diff = addedThis - addedLast;
  const deltaDisplay =
    addedLast > 0
      ? diff === 0
        ? 'No change'
        : `${diff > 0 ? '+' : ''}${Math.round((diff / addedLast) * 100)}%`
      : addedThis > 0
        ? `+${addedThis.toLocaleString('en-US')} new`
        : 'No change';

  const toItem = (c: AnyRecord) => {
    const p = stageOf(c);
    const name =
      String(c.Full_Name ?? '').trim() || [c.First_Name, c.Last_Name].map((v) => String(v ?? '').trim()).filter(Boolean).join(' ') || 'Unnamed candidate';
    const words = name.split(/\s+/).filter(Boolean);
    const d = String(c.Created_Time ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return {
      id: String(c.id ?? name),
      name,
      initials: (words.length > 1 ? [words[0]!, words[words.length - 1]!] : words).map((w) => w[0]!.toUpperCase()).join('') || '?',
      detail: d ? `Added ${d[3]}-${MONTH_ABBR[Number(d[2]) - 1]}-${d[1].slice(-2)}` : '',
      stage: String(c.Candidate_Stage ?? '').trim() || (p?.label ?? ''),
      tone: p?.badgeTone ?? 'muted',
    };
  };
  const pickId = selected === CONVERSION ? 'hired' : selected;
  const inStage = pickId ? inPipeline.filter((c) => stageOf(c)!.id === pickId) : [];
  const selectedCandidates = inStage.slice(0, MAX_CANDIDATE_ROWS).map(toItem);

  return {
    loaded,
    hasData: total > 0,
    totalDisplay: total.toLocaleString('en-US'),
    totalLabel: total === 1 ? 'candidate in motion' : 'candidates in motion',
    deltaDisplay,
    deltaIcon: diff > 0 ? 'ArrowUp' : diff < 0 ? 'ArrowDown' : 'Minus',
    deltaTone: diff > 0 ? 'success' : diff < 0 ? 'destructive' : 'muted',
    deltaCaption: addedLast > 0 ? 'vs. last month' : 'this month',
    stages: PIPELINE_STAGES.map((p) => ({
      id: p.id,
      label: p.label,
      tone: p.tone,
      pct: max > 0 ? Math.round(((counts[p.id] ?? 0) / max) * 100) : 0,
      countDisplay: (counts[p.id] ?? 0).toLocaleString('en-US'),
      expanded: p.id === selected,
      chevron: p.id === selected ? 'ChevronUp' : 'ChevronDown',
      // What a click on this row writes to `/ui/pipelineStage`.
      toggle: p.id === selected ? '' : p.id,
    })),
    selectedCandidates,
    selectedEmpty: !!pickId && selectedCandidates.length === 0,
    selectedNote:
      inStage.length > selectedCandidates.length
        ? `Showing ${selectedCandidates.length} of ${inStage.length.toLocaleString('en-US')} candidates, newest first.`
        : '',
    conversionDisplay: total > 0 ? `${(Math.round((hired / total) * 1000) / 10).toLocaleString('en-US')}%` : '0%',
    hiredFromConversion: selected === CONVERSION,
    // What a click on the conversion line writes to `/ui/pipelineStage`.
    hiredToggle: selected === CONVERSION ? '' : CONVERSION,
    hiredChevron: selected === CONVERSION ? 'ChevronUp' : 'ChevronDown',
    capNote:
      (report.info as AnyRecord | undefined)?.more_records === true
        ? `Based on the newest ${all.length.toLocaleString('en-US')} candidates.`
        : '',
  };
};

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_INTERVIEW_ROWS = 20;

/** Date-range dropdown values: label after the count, and wording for the caption and empty state. */
const INTERVIEW_RANGES: Record<string, { label: string; scope: string }> = {
  week: { label: 'scheduled this week', scope: 'this week' },
  next: { label: 'scheduled next week', scope: 'next week' },
  '30d': { label: 'scheduled in the next 30 days', scope: 'in the next 30 days' },
};

/** Avatar colours rotate down the list, like the mock (blue, green, amber). */
const AVATAR_TONES = ['brand', 'success', 'chart-3'];

/** "10:00 am" in the viewer's time zone. */
function clockTime(d: Date): string {
  const h = d.getHours();
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

/** "12-Nov-26" in the viewer's time zone. */
function ddMmmYy(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}-${MONTH_ABBR[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`;
}

/**
 * Recruit's interview-type field reads "In-person Interview" for everything,
 * so the mode comes from the interview name and venue text.
 */
function interviewMode(i: AnyRecord): { label: string; icon: string; tone: string } {
  const text = `${String(i.Interview_Name ?? '')} ${String(i.Venue ?? '')}`.toLowerCase();
  if (/online|video|zoom|meet|teams|webex/.test(text)) return { label: 'Video', icon: 'Video', tone: 'brand' };
  if (/phone|call/.test(text)) return { label: 'Phone', icon: 'Phone', tone: 'chart-1' };
  return { label: 'Onsite', icon: 'MapPin', tone: 'success' };
}

/**
 * Display-ready state for the Upcoming Interviews tile, from `list_records`
 * on `Interviews`. `range` is `week` (now until Sunday night, the default),
 * `next` (next Monday to Sunday) or `30d` (the next 30 days); cancelled
 * interviews and ones already over are left out. `selected` is the interview
 * whose details show under its row.
 *
 * Spec: `{ "$computed": "zoho-recruit_upcoming_interviews_dashboard", "args": { "report": { "$state": "/zoho-recruit/list_records" }, "range": { "$state": "/ui/interviewRange" }, "selected": { "$state": "/ui/interviewOpen" } } }`
 */
const upcoming_interviews_dashboard: ComputedFunction = (args) => {
  const report = (args.report && typeof args.report === 'object' ? args.report : {}) as AnyRecord;
  const loaded = Array.isArray(report.data);
  const all = loaded ? (report.data as AnyRecord[]) : [];
  const range = typeof args.range === 'string' && INTERVIEW_RANGES[args.range] ? args.range : 'week';
  const selected = typeof args.selected === 'string' ? args.selected : '';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Monday-start weeks.
  const nextMonday = new Date(today.getTime() + (((8 - today.getDay()) % 7) || 7) * DAY_MS);
  const from = range === 'next' ? nextMonday.getTime() : now.getTime();
  const to =
    range === 'week' ? nextMonday.getTime() : range === 'next' ? nextMonday.getTime() + 7 * DAY_MS : now.getTime() + 30 * DAY_MS;

  const upcoming = all
    .map((i) => {
      const start = new Date(String(i.Start_DateTime ?? ''));
      const endRaw = new Date(String(i.End_DateTime ?? ''));
      const end = Number.isNaN(endRaw.getTime()) ? new Date(start.getTime() + 60 * 60 * 1000) : endRaw;
      return { i, start, end };
    })
    .filter(
      ({ i, start, end }) =>
        !Number.isNaN(start.getTime()) &&
        String(i.Interview_Status ?? '').trim().toLowerCase() !== 'cancelled' &&
        // Still to come (or under way) and starting inside the range.
        end.getTime() > now.getTime() &&
        start.getTime() >= (range === 'next' ? from : 0) &&
        start.getTime() < to,
    )
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const rows = upcoming.slice(0, MAX_INTERVIEW_ROWS).map(({ i, start, end }, n) => {
    const id = String(i.id ?? n);
    const name = lookupName(i.Candidate_Name) || 'Unnamed candidate';
    const words = name.split(/\s+/).filter(Boolean);
    const mode = interviewMode(i);
    const type = String(i.Interview_Name ?? '').trim();
    const venue = String(i.Venue ?? '').trim();
    const owner = lookupName(i.Interview_Owner);
    return {
      id,
      name,
      initials: (words.length > 1 ? [words[0]!, words[words.length - 1]!] : words).map((w) => w[0]!.toUpperCase()).join('') || '?',
      avatarTone: AVATAR_TONES[n % AVATAR_TONES.length],
      job: lookupName(i.Job_Opening_Name),
      when: `${ddMmmYy(start)} · ${clockTime(start)}`,
      modeLabel: mode.label,
      modeIcon: mode.icon,
      modeTone: mode.tone,
      expanded: id === selected,
      // What a click on this row writes to `/ui/interviewOpen`.
      toggle: id === selected ? '' : id,
      typeText: type && type !== '-None-' ? type : `${mode.label} interview`,
      timeText: `${ddMmmYy(start)}, ${clockTime(start)} – ${clockTime(end)}`,
      venueText: venue ? `Venue: ${venue}` : '',
      ownerText: owner ? `Owner: ${owner}` : '',
    };
  });

  const count = upcoming.length;
  const r = INTERVIEW_RANGES[range]!;
  return {
    loaded,
    scopeText: `Scheduled interviews ${r.scope}`,
    countDisplay: count.toLocaleString('en-US'),
    countLabel: r.label,
    rows,
    isEmpty: loaded && count === 0,
    emptyText: `No interviews scheduled ${r.scope}.`,
    listNote:
      count > rows.length ? `Showing ${rows.length} of ${count.toLocaleString('en-US')} interviews, soonest first.` : '',
  };
};

/** Result groups, in row and bar order. Pending's amber comes from `chart-3` (`warning` is brown in solid fills). */
const ASSESSMENT_GROUPS = [
  { id: 'passed', label: 'Passed', tone: 'success' },
  { id: 'pending', label: 'Pending', tone: 'chart-3' },
  { id: 'failed', label: 'Failed', tone: 'destructive' },
] as const;

type AssessmentGroupId = (typeof ASSESSMENT_GROUPS)[number]['id'];

/** Badge and avatar tones for the lists (text tones, so `warning` is fine here). */
const ASSESSMENT_BADGE_TONE: Record<AssessmentGroupId, string> = { passed: 'success', pending: 'warning', failed: 'destructive' };

/** No qualifying scores are set on the Recruit templates, so a reviewed rating of 3+ out of 5 counts as a pass. */
const PASS_RATING = 3;

/** `/ui/assessmentGroup` value for the passed list under "Pass rate" (separate from the Passed row). */
const PASS_RATE = 'passrate';

/** Passed / Pending / Failed for one Recruit review, or null when it's archived or expired. */
function assessmentGroup(r: AnyRecord): AssessmentGroupId | null {
  const status = String(r.Status ?? '').trim().toLowerCase();
  if (status === 'pending' || status === 'answered') return 'pending';
  if (status !== 'reviewed') return null;
  if (r.Qualified === true) return 'passed';
  return (Number(r.Rating) || 0) >= PASS_RATING ? 'passed' : 'failed';
}

/**
 * Display-ready state for the Candidate Assessments Status tile, from
 * `list_records` on `Reviews` (Recruit keeps candidate assessment results
 * there; the Assessments module only holds the templates). `selected` is a
 * group id (its reviews show under its row) or `"passrate"` (passed reviews
 * show under the pass rate).
 *
 * Spec: `{ "$computed": "zoho-recruit_candidate_assessments_dashboard", "args": { "report": { "$state": "/zoho-recruit/list_records" }, "selected": { "$state": "/ui/assessmentGroup" } } }`
 */
const candidate_assessments_dashboard: ComputedFunction = (args) => {
  const report = (args.report && typeof args.report === 'object' ? args.report : {}) as AnyRecord;
  const loaded = Array.isArray(report.data);
  const all = loaded ? (report.data as AnyRecord[]) : [];
  const selected = typeof args.selected === 'string' ? args.selected : '';
  const onFile = all.filter((r) => assessmentGroup(r));
  const total = onFile.length;
  const counts: Record<AssessmentGroupId, number> = { passed: 0, pending: 0, failed: 0 };
  for (const r of onFile) counts[assessmentGroup(r)!] += 1;

  // Added this month vs last month, by the date part of `Created_Time` (Recruit's org time).
  const now = new Date();
  const thisKey = now.getFullYear() * 12 + now.getMonth();
  let addedThis = 0;
  let addedLast = 0;
  for (const r of onFile) {
    const m = String(r.Created_Time ?? '').match(/^(\d{4})-(\d{2})/);
    if (!m) continue;
    const key = Number(m[1]) * 12 + Number(m[2]) - 1;
    if (key === thisKey) addedThis += 1;
    else if (key === thisKey - 1) addedLast += 1;
  }
  const diff = addedThis - addedLast;
  const deltaDisplay =
    addedLast > 0
      ? diff === 0
        ? 'No change'
        : `${diff > 0 ? '+' : ''}${Math.round((diff / addedLast) * 100)}%`
      : addedThis > 0
        ? `+${addedThis.toLocaleString('en-US')} new`
        : 'No change';

  const toItem = (r: AnyRecord) => {
    const group = assessmentGroup(r)!;
    const name = lookupName(r.Candidate_Name) || 'Unnamed candidate';
    const words = name.split(/\s+/).filter(Boolean);
    const rating = Number(r.Rating);
    return {
      id: String(r.id ?? name),
      name,
      initials: (words.length > 1 ? [words[0]!, words[words.length - 1]!] : words).map((w) => w[0]!.toUpperCase()).join('') || '?',
      detail: [lookupName(r.Job_Opening_Name), lookupName(r.Assessment_Name)].filter(Boolean).join(' · '),
      ratingText: group === 'pending' ? String(r.Status ?? 'Pending') : Number.isFinite(rating) && r.Rating !== null ? `${rating}/5` : group === 'passed' ? 'Passed' : 'Failed',
      tone: ASSESSMENT_BADGE_TONE[group],
    };
  };
  const pickId = selected === PASS_RATE ? 'passed' : selected;
  const inGroup = pickId ? onFile.filter((r) => assessmentGroup(r) === pickId) : [];
  const selectedReviews = inGroup.slice(0, MAX_CANDIDATE_ROWS).map(toItem);

  return {
    loaded,
    hasData: total > 0,
    totalDisplay: total.toLocaleString('en-US'),
    totalLabel: total === 1 ? 'assessment on file' : 'assessments on file',
    deltaDisplay,
    deltaIcon: diff > 0 ? 'ArrowUp' : diff < 0 ? 'ArrowDown' : 'Minus',
    deltaTone: diff > 0 ? 'success' : diff < 0 ? 'destructive' : 'muted',
    deltaCaption: addedLast > 0 ? 'vs. last month' : 'this month',
    passedCount: counts.passed,
    pendingCount: counts.pending,
    failedCount: counts.failed,
    // Split bar: one `fr` column per non-empty group, sized by its count.
    barTemplate: ASSESSMENT_GROUPS.filter((g) => counts[g.id] > 0)
      .map((g) => `${counts[g.id]}fr`)
      .join(' '),
    rows: ASSESSMENT_GROUPS.map((g) => ({
      id: g.id,
      label: g.label,
      tone: g.tone,
      countDisplay: counts[g.id].toLocaleString('en-US'),
      expanded: g.id === selected,
      chevron: g.id === selected ? 'ChevronUp' : 'ChevronDown',
      // What a click on this row writes to `/ui/assessmentGroup`.
      toggle: g.id === selected ? '' : g.id,
    })),
    selectedReviews,
    selectedEmpty: !!pickId && selectedReviews.length === 0,
    selectedNote:
      inGroup.length > selectedReviews.length
        ? `Showing ${selectedReviews.length} of ${inGroup.length.toLocaleString('en-US')} assessments, newest first.`
        : '',
    passRateDisplay: total > 0 ? `${Math.round((counts.passed / total) * 100)}%` : '0%',
    passExpanded: selected === PASS_RATE,
    // What a click on the pass rate writes to `/ui/assessmentGroup`.
    passToggle: selected === PASS_RATE ? '' : PASS_RATE,
    passChevron: selected === PASS_RATE ? 'ChevronUp' : 'ChevronDown',
    capNote:
      (report.info as AnyRecord | undefined)?.more_records === true
        ? `Based on the newest ${all.length.toLocaleString('en-US')} assessments.`
        : '',
  };
};

const elements: PluginElementsModule = {
  slug: 'zoho-recruit',
  functions: {
    job_openings_dashboard,
    candidate_pipeline_dashboard,
    upcoming_interviews_dashboard,
    candidate_assessments_dashboard,
  },
  actions: {},
};

export default elements;
