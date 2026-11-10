/** Status groups the Open Job Openings Tracker shows, in row and bar order. */
const GROUPS = [
    { id: 'active', label: 'Active', tone: 'brand' },
    // `warning` renders brown in solid fills, so amber comes from `chart-3`.
    { id: 'onHold', label: 'On Hold', tone: 'chart-3' },
    { id: 'closed', label: 'Closed', tone: 'muted' },
];
/** Recruit `Job_Opening_Status` picklist values, by group. Anything else counts as Active. */
const STATUS_GROUP = {
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
const GROUP_BADGE_TONE = { active: 'brand', onHold: 'warning', closed: 'muted' };
const MAX_JOB_ROWS = 20;
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Year and 0-based month an opening was opened: `Date_Opened` (YYYY-MM-DD), else `Created_Time`. */
function openedMonth(j) {
    const opened = String(j.Date_Opened ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (opened)
        return { y: Number(opened[1]), m: Number(opened[2]) - 1, d: Number(opened[3]) };
    const created = new Date(String(j.Created_Time ?? ''));
    if (Number.isNaN(created.getTime()))
        return null;
    return { y: created.getFullYear(), m: created.getMonth(), d: created.getDate() };
}
/** Lookup fields come back as `{ name, id }`; plain text as a string. */
function lookupName(v) {
    if (v && typeof v === 'object')
        return String(v.name ?? '').trim();
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
const job_openings_dashboard = (args) => {
    const report = (args.report && typeof args.report === 'object' ? args.report : {});
    const loaded = Array.isArray(report.data);
    const jobs = loaded ? report.data : [];
    const groupOf = (j) => STATUS_GROUP[String(j?.Job_Opening_Status ?? '').trim().toLowerCase()] ?? 'active';
    const counts = { active: 0, onHold: 0, closed: 0 };
    for (const j of jobs)
        counts[groupOf(j)] += 1;
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
        if (o?.y === thisY && o.m === thisM)
            openedThis += 1;
        else if (o?.y === lastY && o.m === lastM)
            openedLast += 1;
    }
    const delta = openedThis - openedLast;
    const showList = args.showList === true;
    const selected = typeof args.selected === 'string' ? args.selected : '';
    const toItem = (j) => {
        const group = groupOf(j);
        const o = openedMonth(j);
        const where = [lookupName(j.Client_Name), lookupName(j.City)].filter(Boolean).join(' · ');
        const opened = o ? `Opened ${String(o.d).padStart(2, '0')}-${MONTH_ABBR[o.m]}-${String(o.y).slice(-2)}` : '';
        return {
            id: String(j.id ?? ''),
            title: String(j.Posting_Title ?? j.Job_Opening_Name ?? '').trim() || '(Untitled opening)',
            detail: [where, opened].filter(Boolean).join(' · '),
            status: String(j.Job_Opening_Status ?? '').trim() || GROUPS.find((g) => g.id === group).label,
            tone: GROUP_BADGE_TONE[group],
        };
    };
    const jobList = jobs.slice(0, MAX_JOB_ROWS).map(toItem);
    // Openings of the clicked status row, shown under that row.
    const inGroup = selected ? jobs.filter((j) => groupOf(j) === selected) : [];
    const groupJobs = inGroup.slice(0, MAX_JOB_ROWS).map(toItem);
    const more = report.info?.more_records === true;
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
        groupNote: inGroup.length > groupJobs.length
            ? `Showing ${groupJobs.length} of ${inGroup.length.toLocaleString('en-US')} job openings, newest first.`
            : '',
        capNote: more ? `Based on the newest ${total.toLocaleString('en-US')} job openings.` : '',
        totalDisplay: total.toLocaleString('en-US'),
        listExpanded: showList,
        // What a click on the total writes to `/ui/showAllJobs`.
        listToggle: !showList,
        listChevron: showList ? 'ChevronUp' : 'ChevronDown',
        jobList,
        listNote: showList && total > jobList.length
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
];
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
const candidate_pipeline_dashboard = (args) => {
    const report = (args.report && typeof args.report === 'object' ? args.report : {});
    const loaded = Array.isArray(report.data);
    const all = loaded ? report.data : [];
    const selected = typeof args.selected === 'string' ? args.selected : '';
    const stageOf = (c) => {
        const s = String(c?.Candidate_Stage ?? '').trim().toLowerCase();
        return PIPELINE_STAGES.find((p) => p.stages.includes(s));
    };
    const inPipeline = all.filter((c) => stageOf(c));
    const total = inPipeline.length;
    const counts = {};
    for (const c of inPipeline)
        counts[stageOf(c).id] = (counts[stageOf(c).id] ?? 0) + 1;
    const max = Math.max(0, ...Object.values(counts));
    const hired = counts.hired ?? 0;
    // Added this month vs last month, by the date part of `Created_Time` (Recruit's org time).
    const now = new Date();
    const thisKey = now.getFullYear() * 12 + now.getMonth();
    let addedThis = 0;
    let addedLast = 0;
    for (const c of all) {
        const m = String(c.Created_Time ?? '').match(/^(\d{4})-(\d{2})/);
        if (!m)
            continue;
        const key = Number(m[1]) * 12 + Number(m[2]) - 1;
        if (key === thisKey)
            addedThis += 1;
        else if (key === thisKey - 1)
            addedLast += 1;
    }
    const diff = addedThis - addedLast;
    const deltaDisplay = addedLast > 0
        ? diff === 0
            ? 'No change'
            : `${diff > 0 ? '+' : ''}${Math.round((diff / addedLast) * 100)}%`
        : addedThis > 0
            ? `+${addedThis.toLocaleString('en-US')} new`
            : 'No change';
    const toItem = (c) => {
        const p = stageOf(c);
        const name = String(c.Full_Name ?? '').trim() || [c.First_Name, c.Last_Name].map((v) => String(v ?? '').trim()).filter(Boolean).join(' ') || 'Unnamed candidate';
        const words = name.split(/\s+/).filter(Boolean);
        const d = String(c.Created_Time ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
        return {
            id: String(c.id ?? name),
            name,
            initials: (words.length > 1 ? [words[0], words[words.length - 1]] : words).map((w) => w[0].toUpperCase()).join('') || '?',
            detail: d ? `Added ${d[3]}-${MONTH_ABBR[Number(d[2]) - 1]}-${d[1].slice(-2)}` : '',
            stage: String(c.Candidate_Stage ?? '').trim() || (p?.label ?? ''),
            tone: p?.badgeTone ?? 'muted',
        };
    };
    const pickId = selected === CONVERSION ? 'hired' : selected;
    const inStage = pickId ? inPipeline.filter((c) => stageOf(c).id === pickId) : [];
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
        selectedNote: inStage.length > selectedCandidates.length
            ? `Showing ${selectedCandidates.length} of ${inStage.length.toLocaleString('en-US')} candidates, newest first.`
            : '',
        conversionDisplay: total > 0 ? `${(Math.round((hired / total) * 1000) / 10).toLocaleString('en-US')}%` : '0%',
        hiredFromConversion: selected === CONVERSION,
        // What a click on the conversion line writes to `/ui/pipelineStage`.
        hiredToggle: selected === CONVERSION ? '' : CONVERSION,
        hiredChevron: selected === CONVERSION ? 'ChevronUp' : 'ChevronDown',
        capNote: report.info?.more_records === true
            ? `Based on the newest ${all.length.toLocaleString('en-US')} candidates.`
            : '',
    };
};
const elements = {
    slug: 'zoho-recruit',
    functions: {
        job_openings_dashboard,
        candidate_pipeline_dashboard,
    },
    actions: {},
};
export default elements;
