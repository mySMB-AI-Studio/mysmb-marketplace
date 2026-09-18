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
const elements = {
    slug: 'servicem8',
    functions: { join_staff_roles },
};
export default elements;
