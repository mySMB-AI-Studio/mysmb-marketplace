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

    // Try multiple EH field paths for leave type
    const lt = item.leave_type as Record<string, unknown> | string | null | undefined;
    const leaveType: string =
      (typeof lt === 'string' && lt)
        ? lt
        : (lt && typeof lt === 'object' && typeof lt.name === 'string')
          ? lt.name
          : (typeof item.leave_type_name === 'string' && item.leave_type_name)
            ? item.leave_type_name
            : (typeof item.leave_type_id === 'string' && item.leave_type_id)
              ? item.leave_type_id
              : '';

    const { display: startDisplay, ts: startTs } = formatEhDate(item.start_date);
    const { display: endDisplay } = formatEhDate(item.end_date);

    const startDayTs = startTs > 0
      ? new Date(new Date(startTs).setHours(0, 0, 0, 0))
      : null;

    let statusLabel: string;
    let statusTone: string;
    if (startDayTs && startDayTs.getTime() < todayTs) {
      statusLabel = 'Overdue';
      statusTone = 'destructive';
    } else if (startDayTs && startDayTs.getTime() === todayTs) {
      statusLabel = 'Starts Today';
      statusTone = 'warning';
    } else {
      statusLabel = 'Pending';
      statusTone = 'muted';
    }

    const dateRange = [startDisplay, endDisplay].filter(Boolean).join(' → ');

    return {
      id:            String(item.id ?? ''),
      employee_name: empName,
      leave_type:    leaveType,
      date_range:    dateRange,
      status_label:  statusLabel,
      status_tone:   statusTone,
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
  },
};

export default elements;
