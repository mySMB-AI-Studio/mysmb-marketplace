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
const job_history_rows = (args) => {
    const jobs = Array.isArray(args.jobs) ? args.jobs : [];
    const companies = Array.isArray(args.companies) ? args.companies : [];
    const companyNameByUuid = new Map();
    for (const company of companies) {
        const uuid = typeof company.uuid === 'string' ? company.uuid : '';
        const name = typeof company.name === 'string' ? company.name : '';
        if (uuid && name)
            companyNameByUuid.set(uuid, name);
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
const job_status_breakdown = (args) => {
    const jobs = Array.isArray(args.jobs) ? args.jobs : [];
    const tones = {
        Completed: 'success',
        Unsuccessful: 'destructive',
        Quote: 'warning',
    };
    const statusPriority = (status) => status === 'Quote' ? 0 : status === 'Completed' ? 2 : status === 'Unsuccessful' ? 3 : 1;
    const counts = new Map();
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
 * Flattens a `list_companies` response into rows for the Clients tile's
 * Table — every client (active and inactive; this is meant as a full
 * directory, not a filtered workload view), sorted alphabetically by name.
 *
 * Builds a human-readable address from the street/city/state/postcode
 * fields (ServiceM8's own `address` field is frequently blank even when
 * those component fields are populated — confirmed against a real
 * connected account), falling back to the raw `address` field, then to an
 * explicit "No address on file" rather than an empty cell.
 *
 * Precomputes the full `open_url` per row (rather than building it at
 * click time from a raw `uuid`) so the widget's Table `buttonAction` can
 * inject it via a plain `fromRow` field read — no `$item`/`$bindItem`
 * binding involved at all for this click, sidestepping that whole bug
 * class entirely (see json-render-item-vs-binditem-click-bug in prior
 * session notes). Uses ServiceM8's `OpenClient/{uuid}` web-app deep link,
 * the direct counterpart to `OpenJob/{uuid}` already used by this plugin's
 * Job History/Job List tiles — NOT independently re-verified against a
 * live authenticated ServiceM8 session by this change; flagged for the
 * user to confirm with one real click.
 *
 * Args: { companies: array }
 * Returns: array of { uuid, name, address_label, status_label, open_url }
 */
const servicem8_client_rows = (args) => {
    const companies = Array.isArray(args.companies) ? args.companies : [];
    const rows = companies.map((c) => {
        const uuid = typeof c.uuid === 'string' ? c.uuid : '';
        const name = typeof c.name === 'string' && c.name.trim() ? c.name.trim() : 'Unnamed client';
        const parts = [c.address_street, c.address_city, c.address_state, c.address_postcode]
            .map((v) => (typeof v === 'string' ? v.trim() : ''))
            .filter(Boolean);
        const fallbackAddress = typeof c.address === 'string' ? c.address.trim() : '';
        const addressLabel = parts.length > 0 ? parts.join(', ') : fallbackAddress || 'No address on file';
        const isActive = Number(c.active) === 1;
        return {
            uuid,
            name,
            address_label: addressLabel,
            status_label: isActive ? 'Active' : 'Inactive',
            open_url: uuid ? `https://go.servicem8.com/OpenClient/${uuid}` : '',
        };
    });
    return rows.sort((a, b) => a.name.localeCompare(b.name));
};
const elements = {
    slug: 'servicem8',
    functions: {
        join_staff_roles,
        job_history_rows,
        job_status_breakdown,
        client_rows: servicem8_client_rows,
    },
};
export default elements;
