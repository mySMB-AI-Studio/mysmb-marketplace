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

const elements: PluginElementsModule = {
  slug: 'servicem8',
  functions: { join_staff_roles, job_history_rows },
};

export default elements;
