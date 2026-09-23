import type { ComputedFunction, PluginElementsModule } from './types';

/**
 * Flattens a `list_staff_members` response's `staff` array into rows for
 * the Staff Roster tile's Table, resolving each staff record's raw
 * `security_role_uuid` to its real role name via a separately-fetched
 * `list_security_roles` response.
 *
 * A staff record only carries `security_role_uuid` (a foreign-key id) — the
 * ServiceM8 REST API has no combined "staff with role name" endpoint, so
 * this cross-references the two responses client-side (myhub-mcp-servers
 * has no tool for a joined view either — see `myhub-mcp-servers`'s
 * `list_security_roles` tool, which returns the same raw uuid/name shape
 * this function maps against).
 *
 * `Table`'s columns read a single flat field per cell (`resolveField`, no
 * per-cell `$computed` support) — so this also pre-joins `first`+`last`
 * into one `name` field, since the Table can't combine two source fields
 * itself.
 *
 * A staff whose `security_role_uuid` doesn't match any returned role
 * (e.g. a role since renamed/deleted, or the roles call hasn't landed yet)
 * gets "Unknown role" rather than a blank cell — this is a real, visible
 * fallback, not a silent gap.
 *
 * Args: { staff: array, roles: array }
 * Returns: array of { uuid, name, role_name, email, mobile, job_title }
 *
 * Spec example:
 *   {
 *     "$computed": "servicem8_join_staff_roles",
 *     "args": {
 *       "staff": { "$state": "/servicem8/list_staff_members/staff" },
 *       "roles": { "$state": "/servicem8/list_security_roles" }
 *     }
 *   }
 */
const join_staff_roles: ComputedFunction = (args) => {
  const staff = Array.isArray(args.staff) ? (args.staff as Record<string, unknown>[]) : [];
  const roles = Array.isArray(args.roles) ? (args.roles as Record<string, unknown>[]) : [];

  const roleNameByUuid = new Map<string, string>();
  for (const role of roles) {
    const uuid = typeof role.uuid === 'string' ? role.uuid : '';
    const name = typeof role.name === 'string' ? role.name : '';
    if (uuid && name) roleNameByUuid.set(uuid, name);
  }

  return staff.map((s) => {
    const first = typeof s.first === 'string' ? s.first : '';
    const last = typeof s.last === 'string' ? s.last : '';
    const roleUuid = typeof s.security_role_uuid === 'string' ? s.security_role_uuid : '';
    return {
      uuid: s.uuid,
      name: [first, last].filter(Boolean).join(' ') || 'Unnamed staff',
      role_name: roleUuid ? (roleNameByUuid.get(roleUuid) ?? 'Unknown role') : 'No role assigned',
      email: typeof s.email === 'string' ? s.email : '',
      mobile: typeof s.mobile === 'string' ? s.mobile : '',
      job_title: typeof s.job_title === 'string' ? s.job_title : '',
    };
  });
};

/**
 * Flattens a `list_jobs` response into rows for the Job History tile —
 * every job (not filtered by active/inactive, unlike the Job List tile),
 * sorted by `date` descending (most recent first) to match ServiceM8's own
 * job list view. Resolves each job's raw `company_uuid` to a name via a
 * separately-fetched `list_companies` response (same cross-referencing
 * pattern as ServiceM8's job+client join elsewhere — ServiceM8 has no
 * combined job+client endpoint).
 *
 * Self-contained (its own company-name lookup, not shared with any other
 * tile's join helper) so this tile has no dependency on unmerged work.
 *
 * Args: { jobs: array, companies: array }
 * Returns: array of { uuid, date, generated_job_id, company_name, status,
 * active }, sorted by `date` descending.
 */
const job_history_rows: ComputedFunction = (args) => {
  const jobs = Array.isArray(args.jobs) ? (args.jobs as Record<string, unknown>[]) : [];
  const companies = Array.isArray(args.companies) ? (args.companies as Record<string, unknown>[]) : [];

  const companyNameByUuid = new Map<string, string>();
  for (const company of companies) {
    const uuid = typeof company.uuid === 'string' ? company.uuid : '';
    const name = typeof company.name === 'string' ? company.name : '';
    if (uuid && name) companyNameByUuid.set(uuid, name);
  }

  const rows = jobs.map((job) => {
    const companyUuid = typeof job.company_uuid === 'string' ? job.company_uuid : '';
    return {
      uuid: job.uuid,
      date: job.date,
      generated_job_id: job.generated_job_id,
      company_name: companyUuid ? (companyNameByUuid.get(companyUuid) ?? '') : '',
      status: job.status,
      active: job.active,
    };
  });

  return rows.sort((a, b) => {
    const ta = Date.parse(String(a.date ?? '')) || 0;
    const tb = Date.parse(String(b.date ?? '')) || 0;
    return tb - ta;
  });
};

/**
 * Groups job rows by `status` into a proportional segment set for the Job
 * History tile's status-breakdown bar — a single `Row` in CSS grid mode
 * whose `template` column widths this function also computes, so each
 * status renders as one filled `ProgressBar` segment sized to its real
 * share of all jobs (see `servicem8-job-history.json`'s `statusBreakdownBar`
 * — the `template` and `segments` outputs are consumed together and must
 * stay in the same order and count for the grid columns to line up 1:1
 * with the repeated segments).
 *
 * Takes `/ui/rows` (this same tile's already-flattened `job_history_rows`
 * output) rather than the raw `/servicem8/list_jobs/jobs` state — both carry
 * a `status` field, but watching `/ui/rows` as this function's OWN, single-
 * action watch entry (see the widget spec) avoids chaining it after the
 * jobs-watch's `list_companies` call + `setState` pair. Chaining it there
 * as a third action was tried first and silently never ran: the second
 * action's `setState` mutates shared state, which appears to re-render and
 * re-create the watch effect (@json-render/react's `cancelled` flag) before
 * the loop's next iteration — so the third action's promise resolves into
 * an already-cancelled effect and is dropped with no error or warning.
 * Triggering off `/ui/rows` instead sidesteps that race entirely: this is
 * the ONLY action on its watch path, so there is no "next iteration" for a
 * mid-flight re-render to cancel.
 *
 * Tone mapping matches the existing per-row status Badge in the same tile
 * (Completed → success, Unsuccessful → destructive, Quote → warning,
 * anything else, e.g. "Work Order" → info) so the summary bar and the row
 * badges always agree on what color a given status is.
 *
 * Segment order is a fixed pipeline (Quote → other/info statuses in
 * first-seen order → Completed → Unsuccessful) rather than count-sorted, so
 * the bar reads left-to-right as "open work → done/failed" instead of
 * reshuffling every time the mix of jobs changes.
 *
 * `template` widths are plain job-count ratios expressed as CSS `fr` units
 * (not rounded percentages) — `fr` divides the row's actual width by each
 * segment's raw share, so segments always tile edge-to-edge with no
 * rounding-drift gap at the end, regardless of how many statuses there are
 * or how unevenly jobs are split between them.
 *
 * Args: { jobs: array } — pass `/ui/rows` (or any array of objects with a
 * `status` field; the field name matches the raw ServiceM8 job shape too).
 * Returns: { total: number, segments: [{ status, count, tone }], template: string }
 *
 * Spec example:
 *   {
 *     "$computed": "servicem8_job_status_breakdown",
 *     "args": { "jobs": { "$state": "/ui/rows" } }
 *   }
 */
const job_status_breakdown: ComputedFunction = (args) => {
  const jobs = Array.isArray(args.jobs) ? (args.jobs as Record<string, unknown>[]) : [];

  const tones: Record<string, 'success' | 'destructive' | 'warning' | 'info'> = {
    Completed: 'success',
    Unsuccessful: 'destructive',
    Quote: 'warning',
  };
  const statusPriority = (status: string) =>
    status === 'Quote' ? 0 : status === 'Completed' ? 2 : status === 'Unsuccessful' ? 3 : 1;

  const counts = new Map<string, number>();
  for (const job of jobs) {
    const status = typeof job.status === 'string' && job.status ? job.status : 'Unknown';
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }

  const segments = [...counts.entries()]
    .sort((a, b) => statusPriority(a[0]) - statusPriority(b[0]))
    .map(([status, count]) => ({ status, count, tone: tones[status] ?? 'info' }));

  return {
    total: jobs.length,
    segments,
    template: segments.length ? segments.map((s) => `${s.count}fr`).join(' ') : '1fr',
  };
};

/**
 * Groups a `list_jobs` response into a Status | Amount invoicing summary —
 * Quotes, Work Orders, Completed - Pending Approval, Completed - Awaiting
 * Payment — each row summing `total_invoice_amount` for jobs in that state,
 * matching ServiceM8's own Invoicing tab's "Summary" view. Rows are always
 * present, even at 0.00, same as that screen.
 *
 * An earlier draft (mysmb-marketplace PR #870, unmerged) built this as a
 * flat 3-row Quotes/Work Orders/Completed summary, explicitly NOT splitting
 * Completed further — at the time, the connected test account had never had
 * a real invoiced job, so `invoice_sent`/`payment_received`'s semantics
 * were unverified and a wrong guess seemed worse than an honestly coarser
 * number. Confirmed since (2026-09-23) directly against real `list_jobs`
 * output: `invoice_sent` is a real boolean field, `payment_received` a real
 * 0/1 field, both present on every job record regardless of status. The
 * split here is:
 *   - Completed, invoice_sent falsy           -> "Completed - Pending Approval"
 *   - Completed, invoice_sent true, payment_received !== 1 -> "Completed - Awaiting Payment"
 *   - Completed, invoice_sent true, payment_received === 1 -> excluded entirely
 *     (this is a PAID job — ServiceM8's own Summary view doesn't carry a
 *     "Paid" row either; paid jobs live under that screen's separate "Paid"
 *     tab, not its pending-items Summary)
 * Residual caveat this draft can't close: the connected test account still
 * has no job with `invoice_sent: true` to observe, so the Awaiting-Payment
 * bucket's field-mapping is inferred from ServiceM8's own field naming, not
 * confirmed against a real invoiced-and-sent job. Flagged for the user to
 * verify once a real invoice gets sent in this account.
 *
 * Same exclusions as the prior draft, confirmed against a real account's
 * live Invoicing screen: inactive (archived) jobs excluded; "Unsuccessful"
 * jobs excluded (never invoiced, nothing to contribute); no currency symbol
 * prefixed (ServiceM8's API exposes no account-currency field, and the
 * live screen's amounts were confirmed NOT in AUD — showing a wrong symbol
 * is worse than showing none); any status outside ServiceM8's defaults
 * folds into an "Other" row, shown only when non-empty. `list_jobs` caps at
 * 1,000 records per page — sums only the page it's given.
 *
 * Args: { value: array } — the response's `jobs` array.
 * Returns: array of { id, status_label, amount } — the four named rows
 * always present (even "0.00"); "Other" only when non-empty.
 */
const servicem8_invoicing_summary: ComputedFunction = (args) => {
  const jobs = Array.isArray(args.value) ? (args.value as Record<string, unknown>[]) : [];

  const fmtAmt = (n: number): string =>
    new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

  const groups: Record<string, number> = {
    Quote: 0,
    'Work Order': 0,
    'Completed-PendingApproval': 0,
    'Completed-AwaitingPayment': 0,
    Other: 0,
  };
  let hasOther = false;

  for (const job of jobs) {
    if (Number(job.active) !== 1) continue;
    const status = typeof job.status === 'string' ? job.status : '';
    if (status === 'Unsuccessful') continue;
    const amount = Number(job.total_invoice_amount) || 0;

    if (status === 'Completed') {
      const invoiceSent = job.invoice_sent === true || Number(job.invoice_sent) === 1;
      const paymentReceived = Number(job.payment_received) === 1;
      if (!invoiceSent) {
        groups['Completed-PendingApproval'] += amount;
      } else if (!paymentReceived) {
        groups['Completed-AwaitingPayment'] += amount;
      }
      // invoiced AND paid -> excluded, matches ServiceM8's own Summary view
      continue;
    }

    const key = status === 'Quote' || status === 'Work Order' ? status : 'Other';
    groups[key] += amount;
    if (key === 'Other') hasOther = true;
  }

  const rows = [
    { id: 'Quote', status_label: 'Quotes', amount: fmtAmt(groups.Quote) },
    { id: 'Work Order', status_label: 'Work Orders', amount: fmtAmt(groups['Work Order']) },
    {
      id: 'Completed-PendingApproval',
      status_label: 'Completed - Pending Approval',
      amount: fmtAmt(groups['Completed-PendingApproval']),
    },
    {
      id: 'Completed-AwaitingPayment',
      status_label: 'Completed - Awaiting Payment',
      amount: fmtAmt(groups['Completed-AwaitingPayment']),
    },
  ];
  if (hasOther) rows.push({ id: 'Other', status_label: 'Other', amount: fmtAmt(groups.Other) });
  return rows;
};

const elements: PluginElementsModule = {
  slug: 'servicem8',
  functions: {
    join_staff_roles,
    job_history_rows,
    job_status_breakdown,
    invoicing_summary: servicem8_invoicing_summary,
  },
};

export default elements;
