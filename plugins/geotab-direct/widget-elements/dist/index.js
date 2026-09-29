// ── Shared helpers ───────────────────────────────────────────────────────
/**
 * Geotab's docs don't specify the exact wire format for `Duration`-typed
 * fields (Trip.drivingDuration, DeviceStatusInfo.currentStateDuration, etc.)
 * — could be raw seconds, an ISO 8601 duration ("PT1H30M"), or a .NET
 * TimeSpan string ("01:30:00"). Handles all three defensively; UNVERIFIED
 * against a live response — confirm the real shape and simplify once known.
 * Returns minutes.
 */
function durationToMinutes(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        // Assume seconds (Geotab's documented convention for numeric durations,
        // e.g. Trip.engineHours is described in seconds).
        return value / 60;
    }
    const s = String(value ?? '').trim();
    if (!s)
        return 0;
    // ISO 8601 duration: PT1H30M15S
    const iso = s.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/i);
    if (iso) {
        const h = Number(iso[1] ?? 0);
        const m = Number(iso[2] ?? 0);
        const sec = Number(iso[3] ?? 0);
        return h * 60 + m + sec / 60;
    }
    // TimeSpan: [d.]HH:MM:SS[.fff]
    const ts = s.match(/^(?:(\d+)\.)?(\d+):(\d+):(\d+(?:\.\d+)?)$/);
    if (ts) {
        const d = Number(ts[1] ?? 0);
        const h = Number(ts[2] ?? 0);
        const m = Number(ts[3] ?? 0);
        const sec = Number(ts[4] ?? 0);
        return d * 1440 + h * 60 + m + sec / 60;
    }
    return 0;
}
/**
 * Reads the device reference straight off the entity — Geotab's own docs
 * type `device` as a "Device Object" (not a bare id string), and other
 * connectors in this codebase (e.g. Xero's Invoice.Contact) return
 * relationship fields fully inlined with a `.name`, not just an id. Used by
 * the `Get`-backed dashboards below (Trip / FuelTransaction records), which
 * still return this nested shape. `get_vehicle_geofence_status` (the
 * dedicated geofence tool) returns `deviceId`/`deviceName` as flat top-level
 * fields instead — see `vehicle_geofence_dashboard`, which doesn't use this
 * helper.
 */
function deviceIdAndLabel(entity) {
    const dev = entity.device;
    const id = typeof dev?.id === 'string' ? dev.id : '';
    const name = typeof dev?.name === 'string' ? dev.name : '';
    return { id, label: name || id || 'Unknown vehicle' };
}
// ── Tone / format helpers (existing) ────────────────────────────────────
const efficiency_tone = (args) => {
    const n = parseFloat(String(args.value ?? 0));
    if (n >= 15)
        return 'destructive';
    if (n >= 11.5)
        return 'warning';
    return 'muted';
};
const productivity_tone = (args) => {
    const n = parseFloat(String(args.value ?? 0));
    return n < 70 ? 'info' : 'muted';
};
const private_km_tone = (args) => {
    const n = parseFloat(String(args.value ?? 0));
    return n >= 150 ? 'warning' : 'muted';
};
/**
 * ISO date (yyyy-mm-dd) for the start of the current calendar month, local
 * time. The `$month_start_date` magic-string token only resolves inside
 * `dataProvider.params` (confirmed elsewhere in this codebase), not inside
 * a `$computed`'s own args — this fills that gap for fuel_dashboard's MTD
 * cutoff, evaluated fresh each time the computed graph resolves.
 */
const month_start_iso = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
};
const format_duration_hm = (args) => {
    const total = Math.max(0, Math.round(Number(args.minutes ?? 0)));
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h === 0)
        return `${m}m`;
    return `${h}h ${m}m`;
};
// ── Fuel & Efficiency ────────────────────────────────────────────────────
/**
 * Fill-to-fill L/100km per device from raw FuelTransaction records — the
 * standard method (needs no separate Trip fetch): for each device's two
 * most recent fills, efficiency = latest.volume / (latest.odometer -
 * previous.odometer) * 100. Devices with < 2 fills in the fetched window
 * are excluded (not enough data), not fabricated.
 *
 * Also returns MTD cost/volume totals and a daily-volume series (last 7
 * calendar days) for the sparkline.
 *
 * Args: { transactions: FuelTransaction[], monthStartIso: string }
 */
const fuel_dashboard = (args) => {
    const transactions = Array.isArray(args.transactions) ? args.transactions : [];
    const monthStart = String(args.monthStartIso ?? '');
    const byDevice = new Map();
    for (const t of transactions) {
        const { id } = deviceIdAndLabel(t);
        if (!id)
            continue;
        if (!byDevice.has(id))
            byDevice.set(id, []);
        byDevice.get(id).push(t);
    }
    const rows = [];
    for (const [id, fills] of byDevice) {
        const sorted = [...fills].sort((a, b) => Date.parse(String(a.dateTime ?? 0)) - Date.parse(String(b.dateTime ?? 0)));
        if (sorted.length < 2)
            continue;
        const prev = sorted[sorted.length - 2];
        const last = sorted[sorted.length - 1];
        const prevOdo = Number(prev.odometer ?? 0);
        const lastOdo = Number(last.odometer ?? 0);
        const distanceKm = lastOdo - prevOdo;
        const volume = Number(last.volume ?? 0);
        if (distanceKm <= 0 || volume <= 0)
            continue;
        const l100km = (volume / distanceKm) * 100;
        rows.push({
            deviceId: id,
            deviceName: deviceIdAndLabel(last).label,
            l100km: Math.round(l100km * 10) / 10,
            barPercent: Math.min(100, Math.round((l100km / 20) * 100)),
        });
    }
    rows.sort((a, b) => b.l100km - a.l100km);
    const mtd = transactions.filter((t) => String(t.dateTime ?? '') >= monthStart);
    const totalCost = mtd.reduce((sum, t) => sum + Number(t.cost ?? 0), 0);
    const fleetAvgL100km = rows.length
        ? Math.round((rows.reduce((sum, r) => sum + r.l100km, 0) / rows.length) * 10) / 10
        : 0;
    const dailyVolumes = Array(7).fill(0);
    const now = Date.now();
    for (const t of transactions) {
        const ts = Date.parse(String(t.dateTime ?? ''));
        if (Number.isNaN(ts))
            continue;
        const daysAgo = Math.floor((now - ts) / 86_400_000);
        if (daysAgo >= 0 && daysAgo < 7)
            dailyVolumes[6 - daysAgo] += Number(t.volume ?? 0);
    }
    const outliers = rows.filter((r) => r.l100km >= 18).map((r) => r.deviceName);
    return {
        rows: rows.slice(0, 20),
        totalCost: Math.round(totalCost * 100) / 100,
        fleetAvgL100km,
        dailyVolumes,
        outlierNote: outliers.length > 0
            ? `${outliers.length} vehicle(s) reading 18+ L/100km on their latest fill: ${outliers.join(', ')}.`
            : 'No fill-to-fill efficiency outliers in this window.',
    };
};
// ── After-Hours & Private Use ────────────────────────────────────────────
/**
 * Trip has no explicit business/private classification field — only
 * afterHoursDistance / workDistance / afterHoursStart|End. Args: { trips: Trip[] }
 */
const after_hours_dashboard = (args) => {
    const trips = Array.isArray(args.trips) ? args.trips : [];
    const byDevice = new Map();
    const labelById = new Map();
    const daysWithTrips = new Set();
    let afterHoursTripCount = 0;
    for (const t of trips) {
        const { id, label } = deviceIdAndLabel(t);
        const afterHoursKm = Number(t.afterHoursDistance ?? 0);
        if (id) {
            byDevice.set(id, (byDevice.get(id) ?? 0) + afterHoursKm);
            labelById.set(id, label);
        }
        if (t.afterHoursStart === true || t.afterHoursEnd === true)
            afterHoursTripCount += 1;
        const day = String(t.start ?? '').slice(0, 10);
        if (day)
            daysWithTrips.add(day);
    }
    const rows = [...byDevice.entries()]
        .map(([id, km]) => ({
        deviceId: id,
        deviceName: labelById.get(id) ?? id,
        afterHoursKm: Math.round(km * 10) / 10,
        barPercent: Math.min(100, Math.round((km / 200) * 100)),
    }))
        .filter((r) => r.afterHoursKm > 0)
        .sort((a, b) => b.afterHoursKm - a.afterHoursKm)
        .slice(0, 20);
    const totalKm = rows.reduce((sum, r) => sum + r.afterHoursKm, 0);
    const coverageDays = Math.min(84, daysWithTrips.size);
    const coverageWeeks = Math.round((coverageDays / 7) * 10) / 10;
    const worst = rows[0];
    const flagNote = worst && worst.afterHoursKm >= 150
        ? `${worst.deviceName} after-hours use is trending past minor-and-infrequent (${worst.afterHoursKm} km) — worth a second look against the tool-of-trade exemption.`
        : 'No vehicle currently trending past the minor-and-infrequent threshold.';
    return {
        rows,
        totalKm: Math.round(totalKm * 10) / 10,
        afterHoursTripCount,
        coverageWeeks,
        coveragePercent: Math.round((coverageDays / 84) * 100),
        flagNote,
        flagDeviceName: worst?.deviceName ?? '',
    };
};
// ── Travel vs On-Site Time ───────────────────────────────────────────────
/**
 * Trip.stopDuration is documented as including idling time, so "on-site
 * productive" time = stopDuration − idlingDuration, kept separate from
 * idle time. Grouped by DEVICE, not driver. Args: { trips: Trip[] }
 */
const travel_onsite_dashboard = (args) => {
    const trips = Array.isArray(args.trips) ? args.trips : [];
    const byDevice = new Map();
    const labelById = new Map();
    for (const t of trips) {
        const { id, label } = deviceIdAndLabel(t);
        if (!id)
            continue;
        labelById.set(id, label);
        const travel = durationToMinutes(t.drivingDuration);
        const stop = durationToMinutes(t.stopDuration);
        const idle = durationToMinutes(t.idlingDuration);
        const onSite = Math.max(0, stop - idle);
        const cur = byDevice.get(id) ?? { travel: 0, onSite: 0, idle: 0 };
        cur.travel += travel;
        cur.onSite += onSite;
        cur.idle += idle;
        byDevice.set(id, cur);
    }
    const rows = [...byDevice.entries()]
        .map(([id, v]) => {
        const total = v.travel + v.onSite + v.idle;
        const pct = total > 0 ? Math.round((v.onSite / total) * 100) : 0;
        return { deviceId: id, deviceName: labelById.get(id) ?? id, productivePercent: pct };
    })
        .sort((a, b) => b.productivePercent - a.productivePercent)
        .slice(0, 20);
    let totalTravel = 0, totalOnSite = 0, totalIdle = 0;
    for (const v of byDevice.values()) {
        totalTravel += v.travel;
        totalOnSite += v.onSite;
        totalIdle += v.idle;
    }
    const fleetTotal = totalTravel + totalOnSite + totalIdle;
    return {
        rows,
        onSiteMinutes: Math.round(totalOnSite),
        travelMinutes: Math.round(totalTravel),
        idleMinutes: Math.round(totalIdle),
        vehicleCount: byDevice.size,
        fleetProductivePercent: fleetTotal > 0 ? Math.round((totalOnSite / fleetTotal) * 100) : 0,
    };
};
// ── Vehicles On Site Now (real geofencing) ───────────────────────────────
/**
 * The `geotab` plugin's Vehicle Status widget had to be scaled back to a
 * plain driving/stopped/offline list because MyHub's widget runtime keys
 * tool-call state purely by `<mcp>.<tool>` with no per-params
 * disambiguation (registry.ts) — a widget calling the vendor connector's
 * generic `Get` tool twice (DeviceStatusInfo, then Zone) would silently
 * overwrite the first result. This self-hosted server's dedicated
 * `get_vehicle_geofence_status` tool does the DeviceStatusInfo + Zone
 * point-in-polygon match server-side in ONE call, so this widget can show
 * real on-site/in-transit/offline classification with the matched zone
 * name, sidestepping the platform limitation entirely.
 *
 * Input shape (per vehicle), from src/integrations/geotab/api/geofence.ts's
 * `classifyVehicleGeofenceStatus`: { deviceId, deviceName, latitude,
 * longitude, isDriving, isDeviceCommunicating, classification:
 * 'on-site'|'in-transit'|'offline', zoneId, zoneName }.
 *
 * Args: { statuses: VehicleGeofenceStatus[] }
 */
const vehicle_geofence_dashboard = (args) => {
    const statuses = Array.isArray(args.statuses) ? args.statuses : [];
    const order = { 'on-site': 0, 'in-transit': 1, offline: 2 };
    const labelFor = {
        'on-site': 'On Site',
        'in-transit': 'In Transit',
        offline: 'Offline',
    };
    let onSite = 0, inTransit = 0, offline = 0;
    const rows = statuses
        .map((s) => {
        const classification = ['on-site', 'in-transit', 'offline'].includes(String(s.classification))
            ? String(s.classification)
            : 'offline';
        if (classification === 'on-site')
            onSite += 1;
        else if (classification === 'in-transit')
            inTransit += 1;
        else
            offline += 1;
        const deviceName = typeof s.deviceName === 'string' && s.deviceName ? s.deviceName : 'Unknown vehicle';
        const zoneName = typeof s.zoneName === 'string' && s.zoneName ? s.zoneName : '';
        const caption = classification === 'on-site'
            ? zoneName
                ? `On site at ${zoneName}`
                : 'On site'
            : classification === 'in-transit'
                ? 'In transit'
                : 'Offline — no signal';
        return {
            deviceName,
            classification,
            classificationLabel: labelFor[classification],
            zoneName,
            caption,
        };
    })
        .sort((a, b) => {
        const byState = order[a.classification] - order[b.classification];
        return byState !== 0 ? byState : a.deviceName.localeCompare(b.deviceName);
    })
        .slice(0, 20);
    return {
        rows,
        totalCount: statuses.length,
        onSiteCount: onSite,
        inTransitCount: inTransit,
        offlineCount: offline,
    };
};
const vehicle_geofence_tone = (args) => {
    const classification = String(args.value ?? '');
    if (classification === 'in-transit')
        return 'info';
    if (classification === 'offline')
        return 'warning';
    return 'muted'; // on-site
};
const elements = {
    slug: 'geotab-direct',
    functions: {
        efficiency_tone,
        productivity_tone,
        private_km_tone,
        month_start_iso,
        format_duration_hm,
        fuel_dashboard,
        after_hours_dashboard,
        travel_onsite_dashboard,
        vehicle_geofence_dashboard,
        vehicle_geofence_tone,
    },
};
export default elements;
