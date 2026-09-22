/**
 * Maps the `list_basiq_connections` response (the Basiq API's `data` array —
 * see `{ "$state": "/basiq-connect/list_basiq_connections/data" }`) into a
 * single-row summary for the Connections Health tile.
 *
 * Status mapping (Basiq's real connection.status enum has no literal
 * "success"/"running"/"failed" values — this is an interpretive grouping,
 * not a Basiq-documented one):
 *   active            → Success  (connection is up and syncing normally)
 *   pending, pre-init → Running  (still being set up / not yet resolved)
 *   invalid           → Failed   (needs the end-user to reconnect)
 *   anything else     → not counted in any bucket (forward-compatible if
 *                       Basiq adds a new status value)
 *
 * health_label / health_tone:
 *   "No Connections" / muted        — zero connections at all
 *   "Needs Attention" / destructive — Failed connections are >=15% of total
 *   "Healthy" / success              — everything else (a handful of Failed
 *                                      among many healthy ones still reads
 *                                      as Healthy overall)
 *
 * last_used_iso is the most recent `lastUsed` timestamp across all
 * connections, or "" if none have ever synced — bind it through the system
 * `relative_time` computed for display, not a plugin-specific formatter,
 * since "time since an ISO timestamp" isn't Basiq-specific.
 *
 * Returns an array with exactly one summary object (never []), so a tile
 * can bind to row 0 unconditionally — check the RAW data array's own
 * length for the empty state, not this function's output.
 *
 * Args: { value: array }
 *
 * Spec example:
 *   { "$computed": "basiq_flatten_connections_health", "args": { "value": { "$state": "/basiq-connect/list_basiq_connections/data" } } }
 */
const flatten_connections_health = (args) => {
    const raw = Array.isArray(args.value) ? args.value : [];
    let success = 0;
    let running = 0;
    let failed = 0;
    let mostRecentLastUsed = null;
    for (const conn of raw) {
        const status = String(conn.status ?? '').toLowerCase();
        if (status === 'active')
            success++;
        else if (status === 'pending' || status === 'pre-init')
            running++;
        else if (status === 'invalid')
            failed++;
        const lastUsed = conn.lastUsed;
        if (typeof lastUsed === 'string') {
            const t = Date.parse(lastUsed);
            if (!Number.isNaN(t) && (mostRecentLastUsed === null || t > mostRecentLastUsed)) {
                mostRecentLastUsed = t;
            }
        }
    }
    const total = raw.length;
    let healthLabel = 'Healthy';
    let healthTone = 'success';
    if (total === 0) {
        healthLabel = 'No Connections';
        healthTone = 'muted';
    }
    else if (failed / total >= 0.15) {
        healthLabel = 'Needs Attention';
        healthTone = 'destructive';
    }
    return [
        {
            stat_success: String(success),
            stat_running: String(running),
            stat_failed: String(failed),
            health_label: healthLabel,
            health_tone: healthTone,
            last_used_iso: mostRecentLastUsed !== null ? new Date(mostRecentLastUsed).toISOString() : '',
        },
    ];
};
/**
 * Filters the same raw `list_basiq_connections` data array down to the
 * connections in one status bucket, for the Connections Health tile's
 * click-a-stat-to-drill-down breakdown (same bucket grouping as
 * `flatten_connections_health`: pending + pre-init both count as "running").
 *
 * Each row exposes a best-effort display name — the institution's name if
 * the API/fixture included one, else its id, else the connection id — since
 * Basiq's connection resource only guarantees `id`/`status`/`institution.id`
 * are present, not an institution display name.
 *
 * Args: { value: array, bucket: "active" | "pending" | "invalid" }
 *
 * Spec example:
 *   { "$computed": "basiq_connections_by_status", "args": { "value": { "$state": "/basiq-connect/list_basiq_connections/data" }, "bucket": { "$state": "/ui/selectedStatus" } } }
 */
const connections_by_status = (args) => {
    const raw = Array.isArray(args.value) ? args.value : [];
    const bucket = String(args.bucket ?? '');
    if (!bucket)
        return [];
    return raw
        .filter((conn) => {
        const status = String(conn.status ?? '').toLowerCase();
        if (bucket === 'pending')
            return status === 'pending' || status === 'pre-init';
        return status === bucket;
    })
        .map((conn) => {
        const institution = conn.institution;
        const name = (typeof institution?.name === 'string' && institution.name) ||
            (typeof institution?.id === 'string' && institution.id) ||
            String(conn.id ?? 'Connection');
        return {
            id: String(conn.id ?? name),
            name,
            status: String(conn.status ?? ''),
            last_used_iso: typeof conn.lastUsed === 'string' ? conn.lastUsed : '',
        };
    });
};
/**
 * Tone for a single raw Basiq connection status, for the breakdown list's
 * per-row Dot — same bucket grouping as `flatten_connections_health`/
 * `connections_by_status`, but per-item rather than aggregated. Never pass
 * the raw Basiq status enum straight into a tone prop (see
 * TILE-DISPLAY-STANDARDS.md §"Status badges": a connector enum always goes
 * through a normalizing computed, not directly into a tone token).
 *
 * Args: { value: string }
 */
const connection_status_tone = (args) => {
    const status = String(args.value ?? '').toLowerCase();
    if (status === 'active')
        return 'success';
    if (status === 'pending' || status === 'pre-init')
        return 'info';
    if (status === 'invalid')
        return 'destructive';
    return 'muted';
};
/**
 * Human label for a raw status bucket, for the breakdown panel's header —
 * a single dynamic Caption bound to this, rather than three separately
 * `visible`-conditioned Captions (one per bucket) that must stay mutually
 * exclusive by construction. One source of truth avoids that whole class
 * of bug outright instead of relying on three conditions never overlapping.
 *
 * Args: { value: "active" | "pending" | "invalid" | "" }
 */
const status_bucket_label = (args) => {
    const bucket = String(args.value ?? '');
    if (bucket === 'active')
        return 'Success';
    if (bucket === 'pending')
        return 'Running';
    if (bucket === 'invalid')
        return 'Failed';
    return '';
};
const elements = {
    slug: 'basiq',
    functions: {
        flatten_connections_health,
        connections_by_status,
        connection_status_tone,
        status_bucket_label,
    },
};
export default elements;
