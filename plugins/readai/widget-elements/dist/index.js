// Same categorical per-person coloring convention established for Trello's
// Team Workload / Recent Activity tiles: deterministic hash of the person's
// name into chart-1/2/3/5 (chart-4 excluded per earlier design feedback).
const CHART_TONES = ['chart-1', 'chart-2', 'chart-3', 'chart-5'];
function toneForName(name) {
    if (!name)
        return 'muted';
    let hash = 0;
    for (let i = 0; i < name.length; i++)
        hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return CHART_TONES[hash % CHART_TONES.length];
}
function initialFor(name) {
    const trimmed = name.trim();
    return trimmed ? trimmed[0].toUpperCase() : '?';
}
function formatTime12h(ms) {
    const d = new Date(ms);
    let h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    if (h === 0)
        h = 12;
    return `${h}:${m} ${ampm}`;
}
/** Whole local-calendar-day difference between `ms` and now (0 = today, 1 = yesterday, etc.). */
function calendarDaysAgo(ms) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const that = new Date(ms);
    const thatDay = new Date(that.getFullYear(), that.getMonth(), that.getDate()).getTime();
    return Math.round((today - thatDay) / 86_400_000);
}
// Friendly labels for the meeting platforms actually observed — confirmed
// from live get_meetings data ("teams", "meet") and Read.ai's own API
// Reference example ("zoom"). Read.ai's docs don't enumerate a fixed set of
// platform values, so an unrecognized one falls back to a title-cased
// version of the raw string rather than being hidden — still genuinely
// useful at a glance, just not a hand-tuned label.
const PLATFORM_LABELS = {
    teams: 'Microsoft Teams',
    meet: 'Google Meet',
    zoom: 'Zoom',
};
function platformLabel(platform) {
    const key = String(platform ?? '').trim().toLowerCase();
    if (!key)
        return '';
    if (PLATFORM_LABELS[key])
        return PLATFORM_LABELS[key];
    return key.charAt(0).toUpperCase() + key.slice(1);
}
/**
 * "Today · 10:00 AM" / "Yesterday · 2:00 PM" / "2 days ago" — matches the
 * Recent Meetings tile's reference mockup exactly. Recent meetings (today/
 * yesterday) show a time, since that's genuinely useful at that distance;
 * older ones drop it in favor of a plain day count, since the exact time of
 * a meeting from several days ago is rarely what someone's scanning for.
 *
 * Appends the platform label (" · Microsoft Teams") when known, so where a
 * meeting was held is visible at a glance without a separate badge crowding
 * the row's already-tight trailing group (duration + view button). Omitted
 * entirely when the platform is unknown, rather than leaving a stray "· ".
 */
function formatMeetingSubtitle(startMs, platform) {
    const daysAgo = calendarDaysAgo(startMs);
    const dayPart = daysAgo === 0
        ? `Today · ${formatTime12h(startMs)}`
        : daysAgo === 1
            ? `Yesterday · ${formatTime12h(startMs)}`
            : daysAgo <= 0
                ? formatTime12h(startMs) // clock skew / same-day edge case — never show a negative count
                : `${daysAgo} days ago`;
    const platformPart = platformLabel(platform);
    return platformPart ? `${dayPart} · ${platformPart}` : dayPart;
}
/**
 * "32m" / "1h 5m" — Read.ai's API has no duration field (confirmed against
 * the live API Reference); it's always derived from end_time_ms - start_time_ms.
 * Returns null for a still-active meeting (end_time_ms not yet set), so the
 * widget can hide the duration badge entirely rather than show a bogus value.
 */
function formatDuration(startMs, endMs) {
    if (endMs == null)
        return null;
    const minutes = Math.round((endMs - startMs) / 60_000);
    if (minutes < 0)
        return null;
    if (minutes < 60)
        return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
/**
 * Flattens get_meetings' raw `data` array into display rows for the Recent
 * Meetings tile: a deterministic per-owner avatar color/initial, a day-
 * relative subtitle, and a derived duration label (Read.ai has no duration
 * field of its own).
 *
 * Args: { value: array } — list_meetings' raw `data` array.
 */
const flatten_meetings = (args) => {
    const raw = Array.isArray(args.value) ? args.value : [];
    return raw.map((meeting) => {
        const ownerName = String(meeting.owner?.name ?? '').trim();
        const startMs = Number(meeting.start_time_ms ?? 0);
        return {
            id: String(meeting.id ?? ''),
            title: String(meeting.title ?? 'Untitled meeting'),
            initials: initialFor(ownerName),
            avatar_tone: toneForName(ownerName),
            subtitle: startMs ? formatMeetingSubtitle(startMs, meeting.platform) : '',
            duration_label: formatDuration(startMs, meeting.end_time_ms),
            report_url: String(meeting.report_url ?? ''),
            summary: String(meeting.summary ?? '').trim(),
        };
    });
};
// read_score/sentiment/engagement are all plain 0-100 floats, confirmed
// directly from live list_meetings(expand=["metrics"]) data — Read.ai's docs
// show no range at all (their one example per field doesn't match live data),
// so this scale is taken from observation, not documentation. There is no
// trend/delta field in the API; "vs. previous meeting" is computed here by
// diffing the two most recent meetings' metrics (dataProvider requests
// limit: 2), which is why list_meetings — not get_meeting — is the source.
const METRIC_DEFS = [
    { key: 'read_score', label: 'Read Score', tone: 'success' },
    { key: 'sentiment', label: 'Sentiment', tone: 'chart-1' },
    { key: 'engagement', label: 'Engagement', tone: 'warning' },
];
function clampPct(value) {
    return Math.max(0, Math.min(100, Math.round(value)));
}
// Thresholds are a UI-only convention — Read.ai's API has no "tier" field.
function scoreTier(score) {
    if (score >= 80)
        return 'Excellent';
    if (score >= 60)
        return 'Good';
    return 'Needs Improvement';
}
/**
 * Builds the Meeting Score Monitor scorecard from list_meetings' raw `data`
 * array (newest first, `limit: 2`, `expand: ["metrics"]`): the latest
 * meeting's Read Score/Sentiment/Engagement, each with a trend vs. the
 * second-most-recent meeting (absent when there's no prior meeting to
 * compare against), and the latest meeting's own report_url for the footer
 * link.
 *
 * Args: { value: array } — list_meetings' raw `data` array.
 */
const flatten_scorecard = (args) => {
    const raw = Array.isArray(args.value) ? args.value : [];
    const current = raw[0];
    const previous = raw[1];
    if (!current) {
        return {
            has_data: false,
            meeting_title: '',
            has_trend: false,
            metrics: [],
            read_score_label: '',
            read_score_tier: '',
            report_url: '',
        };
    }
    const currentMetrics = current.metrics ?? {};
    const previousMetrics = previous?.metrics ?? {};
    const hasTrend = Object.values(previousMetrics).some((v) => typeof v === 'number');
    const metrics = METRIC_DEFS.map((def) => {
        const value = currentMetrics[def.key];
        const prevValue = previousMetrics[def.key];
        const hasValue = typeof value === 'number';
        const diff = hasValue && typeof prevValue === 'number' ? Math.round(value) - Math.round(prevValue) : null;
        return {
            id: def.key,
            label: def.label,
            value_label: hasValue ? String(Math.round(value)) : '—',
            bar_pct: hasValue ? clampPct(value) : 0,
            bar_tone: def.tone,
            trend_icon: diff ? (diff > 0 ? 'ArrowUp' : 'ArrowDown') : '',
            trend_tone: diff ? (diff > 0 ? 'success' : 'destructive') : 'muted',
            trend_label: diff ? `${diff > 0 ? '+' : ''}${diff}` : '',
        };
    });
    const readScore = currentMetrics.read_score;
    return {
        has_data: true,
        meeting_title: String(current.title ?? 'Untitled meeting'),
        has_trend: hasTrend,
        metrics,
        read_score_label: typeof readScore === 'number' ? String(Math.round(readScore)) : '—',
        read_score_tier: typeof readScore === 'number' ? scoreTier(readScore) : '',
        report_url: String(current.report_url ?? ''),
    };
};
const MAX_ACTION_ITEMS = 8;
// Read.ai's API has no priority field for an action item — just the raw
// sentence — so this is our own keyword heuristic over the sentence text,
// not anything Read.ai assigned. Surfaced in the UI as "Estimated priority"
// (never unlabeled "Priority") so it isn't mistaken for real Read.ai data.
const HIGH_PRIORITY_SIGNALS = [
    'urgent', 'asap', 'critical', 'deadline', 'immediately', 'today', 'tomorrow',
    'proposal', 'contract', 'budget', 'client',
];
const LOW_PRIORITY_SIGNALS = ['inform', 'encourage', 'recommend', 'consider', 'explore'];
function estimatePriority(text) {
    const t = text.toLowerCase();
    if (HIGH_PRIORITY_SIGNALS.some((k) => t.includes(k)))
        return { label: 'High', tone: 'destructive' };
    if (LOW_PRIORITY_SIGNALS.some((k) => t.includes(k)))
        return { label: 'Low', tone: 'success' };
    // 'warning' is deliberately darkened to near-brown in light mode for text
    // contrast (confirmed in tokens.css: #8a5a00) — not the vivid orange the
    // user asked for. 'chart-3' (#f59e0b light / #fbbf24 dark) is genuinely
    // orange in both themes, so it's used here instead.
    return { label: 'Medium', tone: 'chart-3' };
}
/**
 * Flattens list_meetings(expand=["action_items"])' raw `data` array into
 * display rows for the Action Items Tracker tile: one row per action-item
 * sentence, tagged with the title of the meeting it came from and a keyword-
 * estimated priority. Meetings are already newest-first, so items are taken
 * in that order and capped at MAX_ACTION_ITEMS so one meeting with a long
 * list can't crowd out the rest.
 *
 * There's no assignee, due-date, or completed/checked field in Read.ai's API
 * for an action item either — those stay out entirely rather than being
 * fabricated.
 *
 * Args: { value: array } — list_meetings' raw `data` array.
 */
const flatten_action_items = (args) => {
    const raw = Array.isArray(args.value) ? args.value : [];
    const rows = [];
    for (const meeting of raw) {
        const meetingTitle = String(meeting.title ?? 'Untitled meeting');
        const reportUrl = String(meeting.report_url ?? '');
        const items = Array.isArray(meeting.action_items) ? meeting.action_items : [];
        items.forEach((text, index) => {
            const priority = estimatePriority(String(text ?? ''));
            rows.push({
                id: `${meeting.id ?? meetingTitle}-${index}`,
                text: String(text ?? ''),
                meeting_title: meetingTitle,
                priority_label: priority.label,
                priority_tone: priority.tone,
                report_url: reportUrl,
            });
        });
        if (rows.length >= MAX_ACTION_ITEMS)
            break;
    }
    return rows.slice(0, MAX_ACTION_ITEMS);
};
const MAX_KEY_QUESTIONS = 8;
/**
 * Flattens list_meetings(expand=["key_questions"])' raw `data` array into
 * display rows for the Key Questions Tracker tile: one row per question
 * sentence, tagged with the title of the meeting it came from. Meetings are
 * already newest-first, so questions are taken in that order and capped at
 * MAX_KEY_QUESTIONS so one meeting with a long list can't crowd out the rest
 * — same capping approach as flatten_action_items.
 *
 * Unlike action items, there's no keyword-estimated priority here: a
 * question doesn't carry the same "urgent vs. nice-to-have" signal a task
 * does, so each row is just the question text plus where it came from.
 *
 * Args: { value: array } — list_meetings' raw `data` array.
 */
const flatten_key_questions = (args) => {
    const raw = Array.isArray(args.value) ? args.value : [];
    const rows = [];
    for (const meeting of raw) {
        const meetingTitle = String(meeting.title ?? 'Untitled meeting');
        const reportUrl = String(meeting.report_url ?? '');
        const questions = Array.isArray(meeting.key_questions) ? meeting.key_questions : [];
        questions.forEach((text, index) => {
            rows.push({
                id: `${meeting.id ?? meetingTitle}-${index}`,
                text: String(text ?? ''),
                meeting_title: meetingTitle,
                report_url: reportUrl,
            });
        });
        if (rows.length >= MAX_KEY_QUESTIONS)
            break;
    }
    return rows.slice(0, MAX_KEY_QUESTIONS);
};
const UNCATEGORIZED_FOLDER = 'Uncategorized';
const MAX_FOLDERS = 10;
/**
 * Flattens list_meetings' raw `data` array into a single FLAT list of rows
 * for the Meeting Folders tile: a "folder" row per distinct folder name
 * (newest-active-folder-first, i.e. in the order its first meeting appears
 * in the already-newest-first `data` array), immediately followed by a
 * "meeting" row for each meeting filed under it. A meeting with more than
 * one folder appears once under each.
 *
 * There's no nested/relative repeat in this plugin system's widget schema
 * (repeat.statePath is always an absolute state path, confirmed against
 * every other tile in this marketplace — none nests a repeat over a parent
 * item's own array), so this returns one flat array rather than
 * folder-objects-containing-meeting-arrays. The tile's single repeated row
 * template shows either the folder header or a meeting line depending on
 * each row's own `row_type`, with meeting rows additionally gated on
 * matching the currently-expanded folder id — same "$item eq $state"
 * accordion pattern already used by hubspot-support-tickets' ticket detail.
 *
 * A meeting with no folders at all (Read.ai's own field can come back empty
 * or missing — not observed live, but documented as an array) is bucketed
 * under "Uncategorized" rather than silently dropped.
 *
 * Args: { value: array } — list_meetings' raw `data` array.
 */
const flatten_folders = (args) => {
    const raw = Array.isArray(args.value) ? args.value : [];
    const order = [];
    const byFolder = new Map();
    for (const meeting of raw) {
        const names = Array.isArray(meeting.folders) && meeting.folders.length > 0
            ? meeting.folders
            : [UNCATEGORIZED_FOLDER];
        const startMs = Number(meeting.start_time_ms ?? 0);
        const meetingRow = {
            id: String(meeting.id ?? ''),
            title: String(meeting.title ?? 'Untitled meeting'),
            subtitle: startMs ? formatMeetingSubtitle(startMs, meeting.platform) : '',
            report_url: String(meeting.report_url ?? ''),
        };
        for (const name of names) {
            if (!byFolder.has(name)) {
                byFolder.set(name, []);
                order.push(name);
            }
            byFolder.get(name).push(meetingRow);
        }
    }
    const rows = [];
    for (const name of order.slice(0, MAX_FOLDERS)) {
        const folderId = `folder:${name}`;
        const meetings = byFolder.get(name);
        rows.push({ id: folderId, row_type: 'folder', folder_id: folderId, name, meeting_count: meetings.length });
        meetings.forEach((m, index) => {
            rows.push({
                id: `${folderId}:${m.id || index}`,
                row_type: 'meeting',
                folder_id: folderId,
                title: m.title,
                subtitle: m.subtitle,
                report_url: m.report_url,
            });
        });
    }
    return rows;
};
// Rank-based, not name-hashed like toneForName — the whole point is for the
// bar + name + percentage of the SAME speaker to share one color, and for
// the biggest talker to consistently read as the "lead" color regardless of
// whose name hashes where.
const RANK_TONES = ['chart-1', 'chart-5', 'chart-2'];
const MAX_RANKED_SPEAKERS = 3;
/** "Alice Chen" → "AC", "Madonna" → "M", "" → "?" — two-letter initials for the talk-time avatars (distinct from the single-letter `initialFor` used elsewhere). */
function twoLetterInitials(name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0)
        return '?';
    if (parts.length === 1)
        return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
/**
 * Builds the Speaker Talk-Time breakdown for the single most recent meeting
 * (list_meetings(limit: 1, expand=["transcript"])). Read.ai's API has no
 * talk-time or speaking-percentage field at all — this sums each speaker's
 * real turn durations (end_time_ms - start_time_ms, confirmed live) from the
 * raw transcript, the same "derive it from timestamps" approach already used
 * for meeting duration elsewhere in this plugin.
 *
 * Turns attributed to "UNKNOWN_SPEAKER" (confirmed present in live data for
 * voices the transcript couldn't identify) are excluded entirely — both from
 * the ranking and from the percentage denominator — since they can't be
 * attached to a real person. The top 3 speakers by talk time are shown
 * individually; everyone else is rolled into a single "Others" row.
 *
 * Args: { value: array } — list_meetings' raw `data` array.
 */
const flatten_talk_time = (args) => {
    const raw = Array.isArray(args.value) ? args.value : [];
    const meeting = raw[0];
    if (!meeting)
        return { meeting_subtitle: '', meeting_platform: '', report_url: '', speakers: [] };
    const turns = Array.isArray(meeting.transcript?.turns) ? meeting.transcript.turns : [];
    const talkMsByName = new Map();
    for (const turn of turns) {
        const name = String(turn?.speaker?.name ?? '').trim();
        if (!name || name === 'UNKNOWN_SPEAKER')
            continue;
        const durationMs = Number(turn?.end_time_ms ?? 0) - Number(turn?.start_time_ms ?? 0);
        if (!(durationMs > 0))
            continue;
        talkMsByName.set(name, (talkMsByName.get(name) ?? 0) + durationMs);
    }
    const ranked = Array.from(talkMsByName.entries()).sort((a, b) => b[1] - a[1]);
    const totalMs = ranked.reduce((sum, [, ms]) => sum + ms, 0);
    const pctOf = (ms) => (totalMs > 0 ? Math.round((ms / totalMs) * 100) : 0);
    const top = ranked.slice(0, MAX_RANKED_SPEAKERS);
    const rest = ranked.slice(MAX_RANKED_SPEAKERS);
    const speakers = top.map(([name, ms], index) => {
        const pct = pctOf(ms);
        return {
            id: name,
            name,
            initials: twoLetterInitials(name),
            tone: RANK_TONES[index] ?? 'muted',
            bar_pct: pct,
            percent_label: `${pct}%`,
        };
    });
    if (rest.length > 0) {
        const restMs = rest.reduce((sum, [, ms]) => sum + ms, 0);
        const pct = pctOf(restMs);
        speakers.push({
            id: '__others__',
            name: 'Others',
            initials: `+${rest.length}`,
            tone: 'muted',
            bar_pct: pct,
            percent_label: `${pct}%`,
        });
    }
    const title = String(meeting.title ?? 'Untitled meeting');
    const startMs = Number(meeting.start_time_ms ?? 0);
    const durationLabel = formatDuration(startMs, meeting.end_time_ms);
    return {
        meeting_subtitle: durationLabel ? `${title} · ${durationLabel}` : title,
        meeting_platform: platformLabel(meeting.platform),
        report_url: String(meeting.report_url ?? ''),
        speakers,
    };
};
const elements = {
    slug: 'readai',
    functions: {
        flatten_meetings,
        flatten_scorecard,
        flatten_action_items,
        flatten_key_questions,
        flatten_folders,
        flatten_talk_time,
    },
};
export default elements;
