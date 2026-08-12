/**
 * Map a Salesforce Opportunity Probability (0–100) to a semantic tone.
 * >= 70 → "success", >= 40 → "accent", < 40 → "warning".
 *
 * Args: { value: number }
 *
 * Spec example:
 *   { "$computed": "salesforce_probability_tone", "args": { "value": { "$item": "Probability" } } }
 */
const probability_tone = (args) => {
    const v = Number(args.value ?? 0);
    if (v >= 70)
        return 'success';
    if (v >= 40)
        return 'accent';
    return 'warning';
};
/**
 * Map a Salesforce Account Type string to a semantic tone.
 * "Customer" → "success", "Partner" → "info", "Prospect" → "warning", else → "accent".
 *
 * Args: { value: string }
 *
 * Spec example:
 *   { "$computed": "salesforce_account_type_tone", "args": { "value": { "$item": "Type" } } }
 */
const account_type_tone = (args) => {
    const v = String(args.value ?? '');
    if (v.includes('Customer'))
        return 'success';
    if (v.includes('Partner'))
        return 'info';
    if (v === 'Prospect')
        return 'warning';
    return 'accent';
};
/**
 * Express a record's numeric field value as a percentage of the maximum value
 * across all records. Useful for driving ProgressBar widths in a repeat list.
 *
 * Args: { value: number, items: array, field: string }
 *   value — the current item's raw count/amount
 *   items — the full records array (pass via $state path)
 *   field — the field name to read from each item when finding the max
 *
 * Spec example:
 *   { "$computed": "salesforce_pct_of_max", "args": { "value": { "$item": "cnt" }, "items": { "$state": "/salesforce/soql_query/records" }, "field": "cnt" } }
 */
const pct_of_max = (args) => {
    const value = Number(args.value ?? 0);
    const items = Array.isArray(args.items) ? args.items : [];
    const field = String(args.field ?? 'value');
    if (items.length === 0)
        return 0;
    const max = Math.max(...items.map((i) => Number(i[field] ?? 0)));
    if (max === 0)
        return 0;
    return Math.round((value / max) * 100);
};
/**
 * Compute the win rate as a whole-number percentage from an Opportunity records array.
 * win rate = won / closed * 100 (returns 0 if no closed opportunities).
 *
 * Args: { value: array }  — the full Opportunity records array
 *
 * Spec example:
 *   { "$computed": "salesforce_win_rate", "args": { "value": { "$state": "/salesforce/soql_query/records" } } }
 */
const win_rate = (args) => {
    const items = Array.isArray(args.value) ? args.value : [];
    const closed = items.filter((i) => i['IsClosed'] === true);
    if (closed.length === 0)
        return 0;
    const won = closed.filter((i) => i['IsWon'] === true);
    return Math.round((won.length / closed.length) * 100);
};
/**
 * Sort an array of records using a composite "Field|dir" key.
 * Decodes the key, compares numerically when both values are numbers, otherwise lexically.
 * Returns the original array unchanged if key is empty or items is empty.
 *
 * Args: { value: array, key: string }
 *   value — the records array to sort
 *   key   — composite sort key, e.g. "CloseDate|desc" or "Name|asc"
 *
 * Spec example:
 *   { "$computed": "salesforce_sort_by_key", "args": { "value": { "$state": "/salesforce/soql_query/records" }, "key": { "$state": "/ui/sortKey" } } }
 */
const sort_by_key = (args) => {
    const items = Array.isArray(args.value) ? args.value : [];
    const key = String(args.key ?? 'CloseDate|desc');
    const [field, dir] = key.split('|');
    if (!field || items.length === 0)
        return items;
    return [...items].sort((a, b) => {
        const av = a[field] ?? '';
        const bv = b[field] ?? '';
        const an = Number(av);
        const bn = Number(bv);
        const cmp = !isNaN(an) && !isNaN(bn) ? an - bn : String(av).localeCompare(String(bv));
        return dir === 'desc' ? -cmp : cmp;
    });
};
/**
 * Advance /ui/sortKey to the next option in the fixed 6-step cycle.
 * Used by the sort icon-button on.click action.
 *
 * Args: { current: string } — the current /ui/sortKey value
 *
 * Spec example:
 *   { "$computed": "salesforce_cycle_sort", "args": { "current": { "$state": "/ui/sortKey" } } }
 */
const cycle_sort = (args) => {
    const current = String(args.current ?? '');
    const options = ['Name|asc', 'Name|desc'];
    const idx = options.indexOf(current);
    return options[(idx + 1) % options.length];
};
/**
 * Group individual won Opportunity records by rep and compute quota attainment.
 * Accepts non-aggregate Opportunity rows (Owner is a nested object with Name/FirstName/LastName).
 * Groups by OwnerId client-side, then computes attainment % vs a fixed per-rep quota.
 *
 * Thresholds: >=80% → "success", 50–79% → "warning", <50% → "destructive".
 * Progress bar is capped at 100. Amounts formatted as compact currency (e.g. "$840K").
 *
 * Args:
 *   value  — Opportunity[] from a non-aggregate soql_query (IsClosed=true, IsWon=true)
 *   quota  — fixed quota per rep in dollars (default 100000)
 *
 * Spec example:
 *   { "$computed": "salesforce_flatten_quota_attainment", "args": { "value": { "$state": "/salesforce/soql_query/records" }, "quota": 100000 } }
 */
const flatten_quota_attainment = (args) => {
    const records = Array.isArray(args.value) ? args.value : [];
    const quotaAmount = typeof args.quota === 'number' && args.quota > 0 ? args.quota : 100_000;
    const fmt = (v) => {
        const abs = Math.abs(v);
        if (abs >= 1_000_000)
            return `$${(v / 1_000_000).toFixed(1)}M`;
        if (abs >= 1_000)
            return `$${Math.round(v / 1_000)}K`;
        return `$${Math.round(v)}`;
    };
    const repMap = new Map();
    for (const rec of records) {
        const ownerId = String(rec.OwnerId ?? '');
        if (!ownerId)
            continue;
        // Owner fields: nested object (non-aggregate) or flat dotted keys (AggregateResult)
        const owner = rec.Owner ?? {};
        const firstName = String(owner.FirstName ?? rec['Owner.FirstName'] ?? '');
        const lastName = String(owner.LastName ?? rec['Owner.LastName'] ?? '');
        const fullName = firstName && lastName ? `${firstName} ${lastName}` : '';
        const ownerName = String(owner.Name ?? rec['Owner.Name'] ?? (fullName || ownerId));
        let initials;
        if (firstName && lastName) {
            initials = (firstName[0] + lastName[0]).toUpperCase();
        }
        else {
            const parts = ownerName.trim().split(/\s+/);
            initials = parts.length >= 2
                ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
                : ownerName.slice(0, 2).toUpperCase();
        }
        // Amount: direct field (non-aggregate) or SUM alias closedAmount (aggregate)
        const rawAmt = rec.Amount ?? rec.closedAmount;
        const amount = typeof rawAmt === 'number' ? rawAmt : parseFloat(String(rawAmt ?? '0')) || 0;
        const existing = repMap.get(ownerId);
        if (existing) {
            existing.total += amount;
        }
        else {
            repMap.set(ownerId, { name: ownerName, initials, total: amount });
        }
    }
    return [...repMap.entries()]
        .sort((a, b) => b[1].total - a[1].total)
        .map(([ownerId, rep]) => {
        const pct = quotaAmount > 0 ? Math.round((rep.total / quotaAmount) * 100) : 0;
        const barValue = Math.min(pct, 100);
        let tone;
        if (pct >= 80)
            tone = 'success';
        else if (pct >= 50)
            tone = 'warning';
        else
            tone = 'destructive';
        return {
            id: ownerId,
            name: rep.name,
            initials: rep.initials,
            quota_line: `${fmt(rep.total)} closed · ${fmt(quotaAmount)} quota`,
            bar_value: barValue,
            pct_label: `${pct}%`,
            tone,
            badge: pct >= 100 ? `${pct}% ↑` : `${pct}%`,
        };
    });
};
/**
 * Flatten aggregate SOQL records grouped by a state/region field into display rows.
 * Returns { id, value, count, percentage } matching the HubSpot counts shape so
 * insight functions and widget bindings are consistent across connectors.
 * Note: SOQL cannot alias non-aggregate GROUP BY fields, so the stateField must be
 * the raw API name (e.g. "MailingState") — the function renames it to "value" in output.
 *
 * Args:
 *   value      — aggregate records array, e.g. [{ MailingState: "NSW", cnt: 128 }, ...]
 *   stateField — field name for the state/region (default "MailingState")
 *   countField — field name for the count alias (default "cnt")
 *
 * Spec example:
 *   { "$computed": "salesforce_flatten_by_state", "args": { "value": { "$state": "/salesforce/soql_query/records" } } }
 */
const flatten_by_state = (args) => {
    const records = Array.isArray(args.value) ? args.value : [];
    if (records.length === 0)
        return [];
    const stateField = String(args.stateField ?? 'MailingState');
    const countField = String(args.countField ?? 'cnt');
    const total = records.reduce((s, r) => s + Number(r[countField] ?? 0), 0);
    return records.map((r, i) => {
        const value = String(r[stateField] ?? '');
        const count = Number(r[countField] ?? 0);
        const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
        return {
            id: value || String(i),
            value,
            count,
            percentage,
        };
    });
};
/**
 * Sum the count field across all aggregate SOQL state-grouped records.
 * Used to populate /ui/stateTotal for the subtitle and percentage calculations.
 *
 * Args:
 *   value      — aggregate records array
 *   countField — field name for the count alias (default "cnt")
 *
 * Spec example:
 *   { "$computed": "salesforce_state_total", "args": { "value": { "$state": "/salesforce/soql_query/records" } } }
 */
const state_total = (args) => {
    const records = Array.isArray(args.value) ? args.value : [];
    const countField = String(args.countField ?? 'cnt');
    return records.reduce((s, r) => s + Number(r[countField] ?? 0), 0);
};
/**
 * Top-2 state membership insight. Mirrors hubspot_membership_state_insight.
 * Args: { counts: Array<{ value: string, count: number, percentage: number }>, total: number }
 *
 * Spec example:
 *   { "$computed": "salesforce_membership_state_insight", "args": { "counts": { "$state": "/ui/stateRows" }, "total": { "$state": "/ui/stateTotal" } } }
 */
const membership_state_insight = (args) => {
    const counts = Array.isArray(args.counts) ? args.counts : [];
    const total = typeof args.total === 'number' ? args.total : 0;
    const named = counts.filter(c => String(c.value ?? '') !== '(not set)');
    if (named.length === 0 || total <= 0)
        return 'Not enough data yet to surface a membership insight.';
    const top = named.slice(0, 2);
    const combinedCount = top.reduce((sum, c) => sum + Number(c.count ?? 0), 0);
    const combinedPct = Math.round((combinedCount / total) * 100);
    const names = top.map(c => String(c.value ?? '')).join(' and ');
    const verb = top.length > 1 ? 'account for' : 'accounts for';
    return `${names} ${verb} ${combinedPct}% of total membership.`;
};
/**
 * Bottom-2 state growth opportunity insight. Mirrors hubspot_membership_growth_insight.
 * Only returns a sentence when there are 3+ distinct states.
 * Args: { counts: Array<{ value: string, count: number, percentage: number }>, total: number }
 *
 * Spec example:
 *   { "$computed": "salesforce_membership_growth_insight", "args": { "counts": { "$state": "/ui/stateRows" }, "total": { "$state": "/ui/stateTotal" } } }
 */
const membership_growth_insight = (args) => {
    const counts = Array.isArray(args.counts) ? args.counts : [];
    const total = typeof args.total === 'number' ? args.total : 0;
    const named = counts.filter(c => String(c.value ?? '') !== '(not set)');
    if (named.length < 3 || total <= 0)
        return '';
    const lowest = named.slice(-2);
    const names = lowest.map(c => String(c.value ?? '')).join(' and ');
    const combinedPct = Math.round(lowest.reduce((sum, c) => sum + Number(c.percentage ?? 0), 0));
    const verb = lowest.length > 1 ? 'have' : 'has';
    return `${names} ${verb} the smallest share (~${combinedPct}% combined) — potential outreach targets.`;
};
// Fixed cycle of Badge/Dot tones — same as HubSpot's RANK_TONE_CYCLE.
const RANK_TONE_CYCLE = ['accent', 'info', 'success', 'warning', 'destructive', 'muted'];
/**
 * Colors a category row by its position in the count-descending-sorted list rather
 * than by matching its label against a fixed name lookup — membership-type labels
 * vary too much across orgs to reliably map by name.
 *
 * Args: { counts: Array<{ value: string; count: number; percentage: number }>, value: string }
 *
 * Spec example:
 *   { "$computed": "salesforce_category_rank_tone", "args": { "counts": { "$state": "/ui/categoryRows" }, "value": { "$item": "value" } } }
 */
const category_rank_tone = (args) => {
    const counts = Array.isArray(args.counts) ? args.counts : [];
    const value = args.value;
    const index = counts.findIndex((c) => c && c['value'] === value);
    if (index < 0)
        return 'muted';
    return RANK_TONE_CYCLE[index % RANK_TONE_CYCLE.length];
};
/**
 * Compute summary stats for a state breakdown: subtitle text and top-2 insight string.
 *
 * Args:
 *   value      — same aggregate records array passed to salesforce_flatten_by_state
 *   stateField — field name for the state/region (default "MailingState")
 *   countField — field name for the count (default "cnt")
 *   label      — noun for the items being counted, e.g. "members" (default "records")
 *
 * Returns: { subtitleText: string, insightText: string }
 *
 * Spec example:
 *   { "$computed": "salesforce_state_summary", "args": { "value": { "$state": "/salesforce/soql_query/records" }, "label": "members" } }
 */
const state_summary = (args) => {
    const records = Array.isArray(args.value) ? args.value : [];
    if (records.length === 0)
        return { subtitleText: '', insightText: '' };
    const stateField = String(args.stateField ?? 'MailingState');
    const countField = String(args.countField ?? 'cnt');
    const label = String(args.label ?? 'records');
    const total = records.reduce((s, r) => s + Number(r[countField] ?? 0), 0);
    const stateCount = records.length;
    const sorted = [...records].sort((a, b) => Number(b[countField] ?? 0) - Number(a[countField] ?? 0));
    const top1 = sorted[0];
    const top2 = sorted[1];
    const top2Total = Number(top1?.[countField] ?? 0) + Number(top2?.[countField] ?? 0);
    const top2Pct = total > 0 ? Math.round((top2Total / total) * 100) : 0;
    const s1 = String(top1?.[stateField] ?? '');
    const s2 = String(top2?.[stateField] ?? '');
    const subtitleText = `${total.toLocaleString()} ${label} across ${stateCount} states/territories`;
    const insightText = s1 && s2
        ? `${s1} and ${s2} hold ${top2Pct}% of total ${label}.`
        : s1
            ? `${s1} leads with ${total > 0 ? Math.round((Number(top1[countField] ?? 0) / total) * 100) : 0}% of total ${label}.`
            : '';
    return { subtitleText, insightText };
};
/**
 * Map a Salesforce Opportunity StageName to a badge tone using keyword matching,
 * since orgs can rename stages — exact-match would break on custom pipelines.
 *
 * Args: { value: string }
 *
 * Spec example:
 *   { "$computed": "salesforce_deal_stage_tone", "args": { "value": { "$item": "StageName" } } }
 */
const deal_stage_tone = (args) => {
    const s = String(args.value ?? '').toLowerCase();
    if (s.includes('won'))
        return 'success';
    if (s.includes('lost'))
        return 'destructive';
    if (s.includes('negotiation') || s.includes('proposal') || s.includes('price quote'))
        return 'warning';
    if (s.includes('needs analysis') || s.includes('value') || s.includes('decision') || s.includes('perception'))
        return 'accent';
    if (s.includes('qualification'))
        return 'info';
    return 'muted';
};
const or_dash = (args) => {
    const v = args.value;
    if (v === null || v === undefined || v === '')
        return '–';
    return String(v);
};
const list_url = (args) => {
    const object = String(args.object ?? '');
    const instanceUrl = args.instanceUrl ? String(args.instanceUrl).replace(/\/$/, '') : null;
    if (!object) return null;
    if (!instanceUrl) return null;
    return `${instanceUrl}/lightning/o/${object}/list?filterName=Recent`;
};
const STATE_ABBR_MAP = {
    // US States
    'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
    'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
    'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
    'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
    'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
    'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
    'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
    'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
    'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
    'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
    'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
    'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
    'Wisconsin': 'WI', 'Wyoming': 'WY',
    // US Territories
    'District of Columbia': 'DC', 'Puerto Rico': 'PR', 'Guam': 'GU',
    'American Samoa': 'AS', 'U.S. Virgin Islands': 'VI', 'Northern Mariana Islands': 'MP',
    // Australian States & Territories
    'New South Wales': 'NSW', 'Victoria': 'VIC', 'Queensland': 'QLD',
    'Western Australia': 'WA', 'South Australia': 'SA', 'Tasmania': 'TAS',
    'Australian Capital Territory': 'ACT', 'Northern Territory': 'NT',
};
const state_abbr = (args) => {
    const raw = String(args.value ?? '').trim();
    if (!raw) return raw;
    if (STATE_ABBR_MAP[raw]) return STATE_ABBR_MAP[raw];
    if (raw.length <= 3) return raw.toUpperCase();
    return raw;
};
const elements = {
    slug: 'salesforce',
    functions: { probability_tone, account_type_tone, pct_of_max, win_rate, sort_by_key, cycle_sort, flatten_quota_attainment, flatten_by_state, state_total, state_summary, membership_state_insight, membership_growth_insight, category_rank_tone, deal_stage_tone, or_dash, list_url, state_abbr },
};
export default elements;
