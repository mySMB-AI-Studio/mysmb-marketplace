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
const join_staff_roles = (args) => {
    const staff = Array.isArray(args.staff) ? args.staff : [];
    const roles = Array.isArray(args.roles) ? args.roles : [];
    const roleNameByUuid = new Map();
    for (const role of roles) {
        const uuid = typeof role.uuid === 'string' ? role.uuid : '';
        const name = typeof role.name === 'string' ? role.name : '';
        if (uuid && name)
            roleNameByUuid.set(uuid, name);
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
 * Joins a `list_jobs` response's `jobs` array with a separately-fetched
 * `list_companies` response, resolving each job's raw `company_uuid` to the
 * client's real name — same cross-referencing pattern as `join_staff_roles`
 * above (ServiceM8's API has no combined job+client endpoint either).
 *
 * Keeps every original job field intact (spreads the source job record) and
 * only adds `company_name` — the Job List tile's existing bindings
 * (`status`, `active`, `job_address`, `uuid`, etc.) still work unchanged.
 *
 * A job whose `company_uuid` doesn't resolve (company deleted, or the
 * companies call hasn't landed yet) gets `company_name: ''` rather than a
 * placeholder string — the tile's row title falls back further to
 * `generated_job_id` in that case, and an empty string is the right "nothing
 * to show here" value for that fallback chain, not a visible "Unknown
 * client" that would outrank a real generated_job_id fallback.
 *
 * Args: { jobs: array, companies: array }
 * Returns: array of job records (all original fields) + `company_name`
 *
 * Spec example:
 *   {
 *     "$computed": "servicem8_join_job_companies",
 *     "args": {
 *       "jobs": { "$state": "/servicem8/list_jobs/jobs" },
 *       "companies": { "$state": "/servicem8/list_companies/companies" }
 *     }
 *   }
 */
const join_job_companies = (args) => {
    const jobs = Array.isArray(args.jobs) ? args.jobs : [];
    const companies = Array.isArray(args.companies) ? args.companies : [];
    const nameByUuid = new Map();
    for (const company of companies) {
        const uuid = typeof company.uuid === 'string' ? company.uuid : '';
        const name = typeof company.name === 'string' ? company.name : '';
        if (uuid && name)
            nameByUuid.set(uuid, name);
    }
    return jobs.map((job) => {
        const companyUuid = typeof job.company_uuid === 'string' ? job.company_uuid : '';
        return {
            ...job,
            company_name: companyUuid ? (nameByUuid.get(companyUuid) ?? '') : '',
        };
    });
};
/**
 * Groups a `list_jobs` response into a 3-row invoicing summary — Quotes,
 * Work Orders, Completed — each row summing `total_invoice_amount` for jobs
 * in that status, matching ServiceM8's own Invoicing tab's "Summary" view
 * (Status | Amount), which always shows all 4 of its status rows even at
 * zero — so Quote/Work Order/Completed are unconditionally present here too.
 *
 * Two things confirmed by comparing against a real account's live Invoicing
 * screen (2026-09-21) that an unverified first draft got wrong:
 *   - Inactive (archived) jobs are excluded — ServiceM8's own screen doesn't
 *     count them. An earlier draft summed all jobs regardless of `active`
 *     and over-totaled by including one.
 *   - No currency symbol is prefixed. ServiceM8's REST API exposes no
 *     account-currency field anywhere in `list_jobs`, and the real screen's
 *     amounts were NOT in AUD (a hardcoded "A$", copied from another plugin's
 *     convention, was confirmed wrong against the live screenshot) — showing
 *     the wrong symbol is worse than showing none, so this only formats the
 *     number (thousands separator, 2 decimals).
 *
 * Deliberately 3 rows, not the finer "Completed – Pending Approval" /
 * "Completed – Awaiting Payment" split ServiceM8's screen shows: that split
 * would rely on `invoice_sent`/`payment_received` semantics that were never
 * verified against a real completed+invoiced job (the connected test account
 * has never had one) — shipping an unverified guess would risk a wrong
 * number rather than an honestly coarser one.
 *
 * "Unsuccessful" jobs are excluded, same as ServiceM8's own Invoicing tab —
 * a job marked unsuccessful was never invoiced, so it has nothing to
 * contribute to a Status | Amount summary. Any status this account uses
 * outside the 4 ServiceM8 defines (Quote/Work Order/Completed/Unsuccessful)
 * would otherwise vanish from the total silently, so it's folded into a 4th
 * "Other" row instead of being dropped — but only shown when non-empty,
 * since it isn't one of ServiceM8's own categories.
 *
 * `list_jobs` caps at 1,000 records per page (cursor-paginated) — this sums
 * only the page it's given, i.e. first page only for an account with more
 * than 1,000 jobs. Not resolved here; see the tile's own description.
 *
 * Args: { value: array } — the response's `jobs` array.
 * Returns: array of { id, status_label, amount } — Quotes/Work
 * Orders/Completed always present (even "0.00"); "Other" only when non-empty.
 */
const invoicing_summary = (args) => {
    const jobs = Array.isArray(args.value) ? args.value : [];
    const fmtAmt = (n) => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
    const groups = { Quote: 0, 'Work Order': 0, Completed: 0, Other: 0 };
    let hasOther = false;
    for (const job of jobs) {
        if (Number(job.active) !== 1)
            continue;
        const status = typeof job.status === 'string' ? job.status : '';
        if (status === 'Unsuccessful')
            continue;
        const amount = Number(job.total_invoice_amount) || 0;
        const key = status in groups ? status : 'Other';
        groups[key] += amount;
        if (key === 'Other')
            hasOther = true;
    }
    const rows = [
        { id: 'Quote', status_label: 'Quotes', amount: fmtAmt(groups.Quote) },
        { id: 'Work Order', status_label: 'Work Orders', amount: fmtAmt(groups['Work Order']) },
        { id: 'Completed', status_label: 'Completed', amount: fmtAmt(groups.Completed) },
    ];
    if (hasOther)
        rows.push({ id: 'Other', status_label: 'Other', amount: fmtAmt(groups.Other) });
    return rows;
};
const elements = {
    slug: 'servicem8',
    functions: { join_staff_roles, join_job_companies, invoicing_summary },
};
export default elements;
