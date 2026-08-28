/**
 * employment-hero — widget-elements module
 * ──────────────────────────────────────────────────────────────────────────
 * Connector-specific `$computed` helpers contributed to the host's
 * widgets-system at runtime. The host prepends the slug `employment-hero_`
 * to every name in `functions`.
 */

import type { ComputedFunction, PluginElementsModule } from './types';

// ── set_sort_field ────────────────────────────────────────────────────────────
// Set the active sort field. If already sorting by that field, toggles
// direction (asc ↔ desc). Otherwise resets to field|asc.
// Args: { current: string, field: string }
const set_sort_field: ComputedFunction = (args) => {
  const current = String(args.current ?? '');
  const field = String(args.field ?? '');
  const [currentField, currentDir] = current.split('|');
  if (currentField === field) return `${field}|${currentDir === 'asc' ? 'desc' : 'asc'}`;
  return `${field}|asc`;
};

// ── employment_type_tone ──────────────────────────────────────────────────────
// Map EH employment type string to a semantic badge tone.
// Args: { type: string }
const employment_type_tone: ComputedFunction = (args) => {
  const t = String(args.type ?? '').toLowerCase();
  if (t.includes('full'))     return 'success';
  if (t.includes('part'))     return 'warning';
  if (t.includes('casual'))   return 'info';
  if (t.includes('contract')) return 'accent';
  return 'default';
};

// ── Shared date helper ────────────────────────────────────────────────────────
// Parses an ISO date string and returns display string (dd-Mmm-yy per tile
// display standards v2) and a numeric timestamp for sorting.
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatEhDate(raw: unknown): { display: string; ts: number } {
  const s = String(raw ?? '');
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return { display: '', ts: 0 };
  const day = parseInt(m[3], 10);
  const mon = parseInt(m[2], 10) - 1;
  const year = parseInt(m[1], 10);
  return {
    display: `${String(day).padStart(2, '0')}-${MONTHS[mon] ?? m[2]}-${String(year).slice(-2)}`,
    ts: new Date(year, mon, day).getTime(),
  };
}

// ── flatten_employees ─────────────────────────────────────────────────────────
// Sort and normalise raw EH employee objects into display-ready row data.
// Args: { value: raw items array, key: sort key e.g. "full_name|asc" }
const flatten_employees: ComputedFunction = (args) => {
  const raw = Array.isArray(args.value) ? [...(args.value as Record<string, unknown>[])] : [];
  const keyStr = String(args.key ?? 'full_name|asc');
  const [field, dir] = keyStr.split('|');

  const rows = raw.map(item => {
    const { display: startDate, ts: dateSortKey } = formatEhDate(item.start_date);
    return {
      id:              String(item.id ?? ''),
      full_name:       `${item.first_name ?? ''} ${item.last_name ?? ''}`.trim(),
      job_title:       String(item.job_title ?? ''),
      employment_type: String(item.employment_type ?? ''),
      start_date:      startDate,
      date_sort_key:   dateSortKey,
    };
  });

  rows.sort((a, b) => {
    const av = (a as Record<string, unknown>)[field] ?? '';
    const bv = (b as Record<string, unknown>)[field] ?? '';
    const an = Number(av), bn = Number(bv);
    const cmp = !isNaN(an) && !isNaN(bn) ? an - bn : String(av).localeCompare(String(bv));
    return dir === 'desc' ? -cmp : cmp;
  });

  return rows.map(({ date_sort_key: _dk, ...rest }) => rest);
};

// ── flatten_leave_requests ────────────────────────────────────────────────────
// Normalise raw EH leave request objects into display-ready row data.
// Formats ISO dates to dd-Mmm-yy, builds date range string, computes
// status label (Pending / Starts Today / Overdue) and tone per tile standards.
// Args: { value: raw items array }
const flatten_leave_requests: ComputedFunction = (args) => {
  const raw = Array.isArray(args.value) ? [...(args.value as Record<string, unknown>[])] : [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTs = today.getTime();

  return raw.map(item => {
    // Try multiple EH field paths for employee name
    const emp = item.employee as Record<string, unknown> | null | undefined;
    const empName: string =
      (typeof item.employee_name === 'string' && item.employee_name)
        ? item.employee_name
        : (typeof item.requester_name === 'string' && item.requester_name)
          ? item.requester_name
          : emp
            ? (typeof emp.name === 'string' && emp.name)
              ? emp.name
              : `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim()
            : `${item.first_name ?? ''} ${item.last_name ?? ''}`.trim();

    // Try multiple EH field paths for leave type (leave_category_name first, matching server-side resolveLeaveType)
    const lt = item.leave_type as Record<string, unknown> | string | null | undefined;
    const leaveType: string =
      (typeof item.leave_category_name === 'string' && item.leave_category_name)
        ? item.leave_category_name
        : (typeof lt === 'string' && lt)
          ? lt
          : (lt && typeof lt === 'object' && typeof lt.name === 'string')
            ? lt.name
            : (typeof item.leave_type_name === 'string' && item.leave_type_name)
              ? item.leave_type_name
              : '';

    const { display: startDisplay, ts: startTs } = formatEhDate(item.start_date);
    const { display: endDisplay } = formatEhDate(item.end_date);

    const startDayTs = startTs > 0
      ? new Date(new Date(startTs).setHours(0, 0, 0, 0))
      : null;

    const rawStatus = String(item.status ?? '').toLowerCase();
    let statusLabel: string;
    let statusTone: string;
    if (rawStatus === 'approved') {
      statusLabel = 'Approved'; statusTone = 'success';
    } else if (rawStatus === 'declined' || rawStatus === 'rejected') {
      statusLabel = 'Declined'; statusTone = 'destructive';
    } else if (startDayTs && startDayTs.getTime() < todayTs) {
      statusLabel = 'Overdue'; statusTone = 'destructive';
    } else if (startDayTs && startDayTs.getTime() === todayTs) {
      statusLabel = 'Starts Today'; statusTone = 'warning';
    } else {
      statusLabel = 'Pending'; statusTone = 'muted';
    }

    const dateRange = [startDisplay, endDisplay].filter(Boolean).join(' → ');

    return {
      id:             String(item.id ?? ''),
      employee_name:  empName,
      leave_type:     leaveType,
      date_range:     dateRange,
      date_leave_line: [dateRange, leaveType].filter(Boolean).join(' · '),
      review_url:     String(item.review_url ?? ''),
      status_label:   statusLabel,
      status_tone:    statusTone,
    };
  });
};

// ── Shared leave-type resolver ────────────────────────────────────────────────
function resolveEhLeaveType(item: Record<string, unknown>): string {
  if (typeof item.leave_category_name === 'string' && item.leave_category_name) return item.leave_category_name;
  const lt = item.leave_type as Record<string, unknown> | string | null | undefined;
  if (typeof lt === 'string' && lt) return lt;
  if (lt && typeof lt === 'object') {
    if (typeof lt.name === 'string' && lt.name) return lt.name;
    if (typeof lt.title === 'string' && lt.title) return lt.title;
  }
  if (typeof item.leave_type_name === 'string' && item.leave_type_name) return item.leave_type_name;
  return '';
}

// ── flatten_upcoming_leave ────────────────────────────────────────────────────
// Filters approved leave to start_date >= today, sorts ascending.
// Always emits status_label "Approved" / status_tone "success".
// Single-day leave shows one date; multi-day shows "dd-Mmm-yy → dd-Mmm-yy".
// Args: { value: raw items array }
const flatten_upcoming_leave: ComputedFunction = (args) => {
  const raw = Array.isArray(args.value) ? [...(args.value as Record<string, unknown>[])] : [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTs = today.getTime();

  return raw
    .filter(item => {
      const { ts } = formatEhDate(item.start_date);
      return ts > 0 && ts >= todayTs;
    })
    .sort((a, b) => formatEhDate(a.start_date).ts - formatEhDate(b.start_date).ts)
    .map(item => {
      const { display: startDisplay } = formatEhDate(item.start_date);
      const { display: endDisplay } = formatEhDate(item.end_date);
      const dateRange = !endDisplay || startDisplay === endDisplay
        ? startDisplay
        : `${startDisplay} → ${endDisplay}`;
      const emp = item.employee as Record<string, unknown> | null | undefined;
      const empName: string =
        (typeof item.employee_name === 'string' && item.employee_name)
          ? item.employee_name
          : emp
            ? (typeof emp.name === 'string' && emp.name)
              ? emp.name
              : `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim()
            : `${item.first_name ?? ''} ${item.last_name ?? ''}`.trim();
      const rawStatus = String(item.status ?? '').toLowerCase();
      const statusLabel = rawStatus === 'approved' ? 'Approved'
        : rawStatus === 'declined' || rawStatus === 'rejected' ? 'Declined'
        : 'Pending';
      const statusTone = rawStatus === 'approved' ? 'success'
        : rawStatus === 'declined' || rawStatus === 'rejected' ? 'destructive'
        : 'muted';
      return {
        id:            String(item.id ?? ''),
        employee_name: empName,
        leave_type:    resolveEhLeaveType(item),
        date_range:    dateRange,
        status_label:  statusLabel,
        status_tone:   statusTone,
      };
    });
};

// ── flatten_my_leave_requests ─────────────────────────────────────────────────
// Normalises the current user's leave requests into display-ready rows.
// Maps EH status → Approved (success) / Declined (destructive) / Pending (muted).
// Sorts by start_date descending (most recent first).
// Args: { value: raw items array }
const flatten_my_leave_requests: ComputedFunction = (args) => {
  const raw = Array.isArray(args.value) ? [...(args.value as Record<string, unknown>[])] : [];

  return [...raw]
    .sort((a, b) => formatEhDate(b.start_date).ts - formatEhDate(a.start_date).ts)
    .map(item => {
      const { display: startDisplay } = formatEhDate(item.start_date);
      const { display: endDisplay } = formatEhDate(item.end_date);
      const dateRange = !endDisplay || startDisplay === endDisplay
        ? startDisplay
        : `${startDisplay} → ${endDisplay}`;

      const rawStatus = String(item.status ?? '').toLowerCase();
      let statusLabel: string;
      let statusTone: string;
      if (rawStatus === 'approved') {
        statusLabel = 'Approved'; statusTone = 'success';
      } else if (rawStatus === 'declined' || rawStatus === 'rejected') {
        statusLabel = 'Declined'; statusTone = 'destructive';
      } else {
        statusLabel = 'Pending'; statusTone = 'muted';
      }

      const emp = item.employee as Record<string, unknown> | null | undefined;
      const empName: string =
        (typeof item.employee_name === 'string' && item.employee_name)
          ? item.employee_name
          : emp
            ? (typeof emp.name === 'string' && emp.name)
              ? emp.name
              : `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim()
            : `${item.first_name ?? ''} ${item.last_name ?? ''}`.trim();

      const { display: submittedDisplay } = formatEhDate(
        item.created_at ?? item.submitted_at ?? item.lodged_at ?? item.lodgement_date ?? item.date_lodged
      );
      let submittedLabel = submittedDisplay ? `Submitted ${submittedDisplay}` : '';
      if (rawStatus === 'approved') {
        const { display: actionDisplay } = formatEhDate(
          item.approved_at ?? item.approved_date ?? item.reviewed_at ?? item.actioned_at
        );
        if (actionDisplay) submittedLabel += ` · Approved ${actionDisplay}`;
      } else if (rawStatus === 'declined' || rawStatus === 'rejected') {
        const { display: actionDisplay } = formatEhDate(
          item.declined_at ?? item.declined_date ?? item.rejected_at ?? item.reviewed_at ?? item.actioned_at
        );
        if (actionDisplay) submittedLabel += ` · Declined ${actionDisplay}`;
      }

      return {
        id:              String(item.id ?? ''),
        employee_name:   empName,
        leave_type:      resolveEhLeaveType(item),
        date_range:      dateRange,
        status_label:    statusLabel,
        status_tone:     statusTone,
        submitted_label: submittedLabel,
      };
    });
};

// ── flatten_compliance_at_risk ────────────────────────────────────────────────
// The MCP server pre-filters to at-risk items only and sets status_label/
// status_tone ("Overdue"/"Due Today") and status_tone. This function only
// builds display_name and formats due_date — both unavailable server-side.
// Args: { value: pre-filtered items array from list_compliance_documents }
const flatten_compliance_at_risk: ComputedFunction = (args) => {
  const raw = Array.isArray(args.value) ? (args.value as Record<string, unknown>[]) : [];

  return raw.map(item => {
    const certName = String(item.name ?? item.certification_name ?? item.document_name ?? item.title ?? '');
    const empName = String(item.employee_name ?? '').trim();
    const displayName = empName ? `${certName} — ${empName}` : certName;

    const dueRaw = item.due_date ?? item.expiry_date ?? item.expires_at;
    const { display: dueDisplay } = formatEhDate(dueRaw);

    return {
      id:           String(item.id ?? ''),
      display_name: displayName,
      due_date:     dueDisplay,
      status_label: String(item.status_label ?? ''),
      status_tone:  String(item.status_tone ?? ''),
    };
  });
};

// ── flatten_timesheets_to_approve ─────────────────────────────────────────────
// Normalises per-employee aggregated timesheet data into display-ready rows.
// Status: "Overdue" (destructive) if end_date < today, "Pending" (muted) otherwise.
// Args: { value: raw items array }
const flatten_timesheets_to_approve: ComputedFunction = (args) => {
  const raw = Array.isArray(args.value) ? [...(args.value as Record<string, unknown>[])] : [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTs = today.getTime();

  return raw.map(item => {
    const emp = item.employee as Record<string, unknown> | null | undefined;
    const empName = String(
      item.employee_name ?? emp?.name ??
      `${emp?.first_name ?? ''} ${emp?.last_name ?? ''}`.trim() ?? ''
    );

    const totalHours = Number(item.total_hours ?? item.hours ?? 0);
    const hoursDisplay = `${totalHours.toFixed(1)} hrs`;

    const { display: startDisplay } = formatEhDate(item.start_date);
    const { display: endDisplay, ts: endTs } = formatEhDate(item.end_date);
    const payPeriod = !endDisplay || startDisplay === endDisplay
      ? startDisplay
      : `${startDisplay} → ${endDisplay}`;

    return {
      id:            String(item.id ?? ''),
      employee_name: empName,
      hours_display: hoursDisplay,
      pay_period:    payPeriod,
      status_label:  endTs > 0 && endTs < todayTs ? 'Overdue' : 'Pending',
      status_tone:   endTs > 0 && endTs < todayTs ? 'destructive' : 'muted',
    };
  });
};

// ── flatten_my_upcoming_leave ─────────────────────────────────────────────────
// Filters the current user's approved leave to start_date >= today, sorts
// ascending, and computes a "In X Days" / "Tomorrow" / "Today" countdown.
// Args: { value: raw items array }
const flatten_my_upcoming_leave: ComputedFunction = (args) => {
  const raw = Array.isArray(args.value) ? [...(args.value as Record<string, unknown>[])] : [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTs = today.getTime();

  return raw
    .filter(item => {
      const { ts } = formatEhDate(item.start_date);
      return ts > 0 && ts >= todayTs;
    })
    .sort((a, b) => formatEhDate(a.start_date).ts - formatEhDate(b.start_date).ts)
    .map(item => {
      const { display: startDisplay, ts: startTs } = formatEhDate(item.start_date);
      const { display: endDisplay } = formatEhDate(item.end_date);
      const dateRange = !endDisplay || startDisplay === endDisplay
        ? startDisplay
        : `${startDisplay} → ${endDisplay}`;

      const daysUntil = Math.round((startTs - todayTs) / 86400000);
      const daysLabel = daysUntil === 0 ? 'Today'
        : daysUntil === 1 ? 'Tomorrow'
        : `In ${daysUntil} Days`;

      return {
        id:         String(item.id ?? ''),
        leave_type: resolveEhLeaveType(item),
        date_range: dateRange,
        days_label: daysLabel,
      };
    });
};

// ── flatten_direct_reports_upcoming_leave ─────────────────────────────────────
// Formats approved upcoming leave for the connected manager's direct reports.
// date_header uses uppercase months (dd-MMM-yy) with day-of-week for single days.
// Args: { value: raw items array from get_direct_reports_upcoming_leave }
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_UPPER = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

function formatEhDateUpper(raw: unknown): { display: string; ts: number; dow: string } {
  const s = String(raw ?? '');
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return { display: '', ts: 0, dow: '' };
  const day = parseInt(m[3], 10);
  const mon = parseInt(m[2], 10) - 1;
  const year = parseInt(m[1], 10);
  const d = new Date(year, mon, day);
  return {
    display: `${String(day).padStart(2, '0')}-${MONTHS_UPPER[mon] ?? m[2]}-${String(year).slice(-2)}`,
    ts: d.getTime(),
    dow: (DAYS_SHORT[d.getDay()] ?? '').toUpperCase(),
  };
}

const flatten_direct_reports_upcoming_leave: ComputedFunction = (args) => {
  const raw = Array.isArray(args.value) ? [...(args.value as Record<string, unknown>[])] : [];

  return raw.map(item => {
    const { display: startDisplay, dow } = formatEhDateUpper(item.start_date);
    const { display: endDisplay } = formatEhDateUpper(item.end_date);

    let dateHeader: string;
    if (!endDisplay || startDisplay === endDisplay) {
      dateHeader = dow ? `${startDisplay} (${dow})` : startDisplay;
    } else {
      dateHeader = `${startDisplay} → ${endDisplay}`;
    }

    const emp = item.employee as Record<string, unknown> | null | undefined;
    const empName: string =
      (typeof item.employee_name === 'string' && item.employee_name)
        ? item.employee_name
        : emp
          ? `${emp.first_name ?? ''} ${emp.last_name ?? ''}`.trim()
          : `${item.first_name ?? ''} ${item.last_name ?? ''}`.trim();

    return {
      id:            String(item.id ?? ''),
      date_header:   dateHeader,
      employee_name: empName,
      leave_type:    resolveEhLeaveType(item),
    };
  });
};

// ── flatten_timesheet_daily_summary ──────────────────────────────────────────
// Groups this-week timesheet entries by date, sums hours per day.
// Index-0 item carries period_range and total_hours_display for the header badge.
// Args: { value: raw items from get_timesheets_this_week }
const flatten_timesheet_daily_summary: ComputedFunction = (args) => {
  const raw = Array.isArray(args.value) ? (args.value as Record<string, unknown>[]) : [];
  if (raw.length === 0) return [];

  const groups = new Map<string, { hours: number; count: number }>();
  let totalHours = 0;
  let minDate = '';
  let maxDate = '';

  for (const item of raw) {
    const date = String(item.date ?? '');
    if (!date) continue;
    const hrs = Number(item.hours ?? 0);
    totalHours += hrs;
    if (!minDate || date < minDate) minDate = date;
    if (!maxDate || date > maxDate) maxDate = date;
    const existing = groups.get(date);
    if (existing) {
      existing.hours += hrs;
      existing.count += 1;
    } else {
      groups.set(date, { hours: hrs, count: 1 });
    }
  }

  const sortedDates = Array.from(groups.keys()).sort();
  const { display: startDisplay } = formatEhDate(minDate);
  const { display: endDisplay } = formatEhDate(maxDate);
  const periodRange = startDisplay === endDisplay ? startDisplay : `${startDisplay} → ${endDisplay}`;
  const totalRounded = Math.round(totalHours * 10) / 10;
  const totalHoursDisplay = `${totalRounded} hrs`;

  return sortedDates.map((date, i) => {
    const g = groups.get(date)!;
    const { display: dateHeader } = formatEhDate(date);
    const dayHrs = Math.round(g.hours * 10) / 10;
    return {
      id:                  date,
      date_header:         dateHeader,
      hours_display:       `${dayHrs} hrs`,
      entry_count_label:   g.count === 1 ? '1 entry' : `${g.count} entries`,
      period_range:        i === 0 ? periodRange : '',
      total_hours_display: i === 0 ? totalHoursDisplay : '',
    };
  });
};

// ── flatten_team_timesheet_entries ────────────────────────────────────────────
// Normalises per-entry timesheet rows for the team view: employee name, date,
// hours, and status badge. Sorted by date asc then employee name asc.
// Args: { value: raw items from get_timesheets_this_week }
const flatten_team_timesheet_entries: ComputedFunction = (args) => {
  const raw = Array.isArray(args.value) ? (args.value as Record<string, unknown>[]) : [];

  return [...raw]
    .sort((a, b) => {
      const da = String(a.date ?? '');
      const db = String(b.date ?? '');
      if (da !== db) return da.localeCompare(db);
      return String(a.employee_name ?? '').localeCompare(String(b.employee_name ?? ''));
    })
    .map(item => {
      const { display: dateCaption } = formatEhDate(item.date);
      const hrs = Math.round(Number(item.hours ?? 0) * 10) / 10;
      const rawStatus = String(item.status ?? '').toLowerCase();
      const statusLabel = rawStatus === 'approved' ? 'Approved'
        : rawStatus === 'declined' || rawStatus === 'rejected' ? 'Declined'
        : 'Pending';
      const statusTone = rawStatus === 'approved' ? 'success'
        : rawStatus === 'declined' || rawStatus === 'rejected' ? 'destructive'
        : 'muted';
      return {
        id:            String(item.id ?? ''),
        employee_name: String(item.employee_name ?? '').trim(),
        date_caption:  dateCaption,
        hours_display: `${hrs} hrs`,
        status_label:  statusLabel,
        status_tone:   statusTone,
      };
    });
};

const elements: PluginElementsModule = {
  slug: 'employment-hero',
  functions: {
    set_sort_field,
    employment_type_tone,
    flatten_employees,
    flatten_leave_requests,
    flatten_upcoming_leave,
    flatten_my_leave_requests,
    flatten_my_upcoming_leave,
    flatten_compliance_at_risk,
    flatten_timesheets_to_approve,
    flatten_direct_reports_upcoming_leave,
    flatten_timesheet_daily_summary,
    flatten_team_timesheet_entries,
  },
};

export default elements;
