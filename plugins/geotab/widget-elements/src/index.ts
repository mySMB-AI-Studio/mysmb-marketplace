import type { ComputedFunction, PluginElementsModule } from './types';

// ── Shared helpers ───────────────────────────────────────────────────────

/**
 * Geotab's docs don't specify the exact wire format for `Duration`-typed
 * fields (Trip.drivingDuration, DeviceStatusInfo.currentStateDuration, etc.)
 * — could be raw seconds, an ISO 8601 duration ("PT1H30M"), or a .NET
 * TimeSpan string ("01:30:00"). Handles all three defensively; UNVERIFIED
 * against a live response — confirm the real shape and simplify once known.
 * Returns minutes.
 */
function durationToMinutes(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Assume seconds (Geotab's documented convention for numeric durations,
    // e.g. Trip.engineHours is described in seconds).
    return value / 60;
  }
  const s = String(value ?? '').trim();
  if (!s) return 0;
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
 * relationship fields fully inlined with a `.name`, not just an id. Since
 * the `Get` tool can only be called ONCE per widget without a second call
 * silently overwriting the first at the same `/geotab/Get` state path (no
 * per-typeName disambiguation — confirmed against the real runtime), a
 * second Device-list fetch+join isn't an option here anyway. Falls back to
 * the raw id if `.name` isn't actually present — UNVERIFIED assumption,
 * confirm against a live response.
 */
function deviceIdAndLabel(entity: Record<string, unknown>): { id: string; label: string } {
  const dev = entity.device as Record<string, unknown> | undefined;
  const id = typeof dev?.id === 'string' ? dev.id : '';
  const name = typeof dev?.name === 'string' ? dev.name : '';
  return { id, label: name || id || 'Unknown vehicle' };
}

// ── Tone / format helpers (existing) ────────────────────────────────────

const efficiency_tone: ComputedFunction = (args) => {
  const n = parseFloat(String(args.value ?? 0));
  if (n >= 15) return 'destructive';
  if (n >= 11.5) return 'warning';
  return 'muted';
};

const productivity_tone: ComputedFunction = (args) => {
  const n = parseFloat(String(args.value ?? 0));
  return n < 70 ? 'info' : 'muted';
};

const private_km_tone: ComputedFunction = (args) => {
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
const month_start_iso: ComputedFunction = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
};

const vehicle_state_tone: ComputedFunction = (args) => {
  const state = String(args.value ?? '');
  if (state === 'Offline') return 'warning';
  if (state === 'Driving') return 'info';
  return 'muted';
};

const format_duration_hm: ComputedFunction = (args) => {
  const total = Math.max(0, Math.round(Number(args.minutes ?? 0)));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
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
 * calendar days) for the sparkline — a real, simple aggregate, not the
 * synthetic smooth trend the demo used.
 *
 * Args: { transactions: FuelTransaction[], monthStartIso: string }
 */
const fuel_dashboard: ComputedFunction = (args) => {
  const transactions = Array.isArray(args.transactions) ? (args.transactions as Record<string, unknown>[]) : [];
  const monthStart = String(args.monthStartIso ?? '');

  const byDevice = new Map<string, Record<string, unknown>[]>();
  for (const t of transactions) {
    const { id } = deviceIdAndLabel(t);
    if (!id) continue;
    if (!byDevice.has(id)) byDevice.set(id, []);
    byDevice.get(id)!.push(t);
  }

  const rows: { deviceId: string; deviceName: string; l100km: number; barPercent: number }[] = [];
  for (const [id, fills] of byDevice) {
    const sorted = [...fills].sort(
      (a, b) => Date.parse(String(a.dateTime ?? 0)) - Date.parse(String(b.dateTime ?? 0)),
    );
    if (sorted.length < 2) continue;
    const prev = sorted[sorted.length - 2]!;
    const last = sorted[sorted.length - 1]!;
    const prevOdo = Number(prev.odometer ?? 0);
    const lastOdo = Number(last.odometer ?? 0);
    const distanceKm = lastOdo - prevOdo;
    const volume = Number(last.volume ?? 0);
    if (distanceKm <= 0 || volume <= 0) continue;
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

  const dailyVolumes: number[] = Array(7).fill(0);
  const now = Date.now();
  for (const t of transactions) {
    const ts = Date.parse(String(t.dateTime ?? ''));
    if (Number.isNaN(ts)) continue;
    const daysAgo = Math.floor((now - ts) / 86_400_000);
    if (daysAgo >= 0 && daysAgo < 7) dailyVolumes[6 - daysAgo] += Number(t.volume ?? 0);
  }

  // Honest substitute for the demo's fabricated tank-overfill/odd-hour
  // exceptions (those need tank capacity + depot distance, neither of
  // which FuelTransaction exposes) — flag fills whose OWN fill-to-fill
  // efficiency reading is unusually poor instead.
  const outliers = rows.filter((r) => r.l100km >= 18).map((r) => r.deviceName);

  return {
    rows: rows.slice(0, 20),
    totalCost: Math.round(totalCost * 100) / 100,
    fleetAvgL100km,
    dailyVolumes,
    outlierNote:
      outliers.length > 0
        ? `${outliers.length} vehicle(s) reading 18+ L/100km on their latest fill: ${outliers.join(', ')}.`
        : 'No fill-to-fill efficiency outliers in this window.',
  };
};

// ── After-Hours & Private Use ────────────────────────────────────────────

/**
 * Trip has no explicit business/private classification field — only
 * afterHoursDistance / workDistance / afterHoursStart|End. The demo's
 * "Business 94% / Private 6% / Unclassified 17 trips" badges aren't
 * derivable from this schema and are dropped rather than faked.
 *
 * "12-week logbook coverage" is real and derivable: distinct calendar
 * days with at least one trip, within the fetched window, against an
 * 84-day (12-week) target.
 *
 * Args: { trips: Trip[] }
 */
const after_hours_dashboard: ComputedFunction = (args) => {
  const trips = Array.isArray(args.trips) ? (args.trips as Record<string, unknown>[]) : [];

  const byDevice = new Map<string, number>();
  const labelById = new Map<string, string>();
  const daysWithTrips = new Set<string>();
  let afterHoursTripCount = 0;

  for (const t of trips) {
    const { id, label } = deviceIdAndLabel(t);
    const afterHoursKm = Number(t.afterHoursDistance ?? 0);
    if (id) {
      byDevice.set(id, (byDevice.get(id) ?? 0) + afterHoursKm);
      labelById.set(id, label);
    }
    if (t.afterHoursStart === true || t.afterHoursEnd === true) afterHoursTripCount += 1;
    const day = String(t.start ?? '').slice(0, 10);
    if (day) daysWithTrips.add(day);
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
  const flagNote =
    worst && worst.afterHoursKm >= 150
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
 * idle time. Grouped by DEVICE, not driver — Driver's field schema wasn't
 * confirmed against Geotab's docs this pass, Device's was.
 *
 * Args: { trips: Trip[] }
 */
const travel_onsite_dashboard: ComputedFunction = (args) => {
  const trips = Array.isArray(args.trips) ? (args.trips as Record<string, unknown>[]) : [];

  const byDevice = new Map<string, { travel: number; onSite: number; idle: number }>();
  const labelById = new Map<string, string>();
  for (const t of trips) {
    const { id, label } = deviceIdAndLabel(t);
    if (!id) continue;
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

// ── Vehicle Status ───────────────────────────────────────────────────────

/**
 * Originally designed as live geofence on-site/in-transit classification
 * (DeviceStatusInfo coordinates point-in-polygon against Zone.points), but
 * that requires TWO Geotab entity-type fetches (DeviceStatusInfo + Zone) in
 * one widget. MyHub's widget runtime keys tool-call state purely by
 * `<mcp>.<tool>` with no per-params disambiguation (registry.ts) and gives
 * plugin actions no way to call a tool directly (only store read/write) —
 * so a second `Get` call for Zone silently overwrites the first at
 * `/geotab/Get`, no matter how it's wired (dataProvider, watch-chained
 * action, or plugin action). Confirmed unfixable at the widget/plugin
 * layer; would need a platform change (e.g. an explicit custom result-key
 * on watch actions) to do real geofencing here. Simplified instead to a
 * single DeviceStatusInfo fetch: real-time driving/stopped/offline status
 * per vehicle, no zone matching.
 *
 * Args: { statuses: DeviceStatusInfo[] }
 */
const vehicle_status_dashboard: ComputedFunction = (args) => {
  const statuses = Array.isArray(args.statuses) ? (args.statuses as Record<string, unknown>[]) : [];

  let driving = 0, stopped = 0, offline = 0;
  const rows = statuses
    .map((s) => {
      const communicating = s.isDeviceCommunicating === true;
      const isDriving = s.isDriving === true;
      const state = !communicating ? 'Offline' : isDriving ? 'Driving' : 'Stopped';
      if (!communicating) offline += 1;
      else if (isDriving) driving += 1;
      else stopped += 1;

      return {
        deviceName: deviceIdAndLabel(s).label,
        state,
        speedKmh: Math.round(Number(s.speed ?? 0)),
        stateMinutes: durationToMinutes(s.currentStateDuration),
      };
    })
    .sort((a, b) => b.stateMinutes - a.stateMinutes)
    .slice(0, 20);

  return {
    rows,
    totalCount: statuses.length,
    drivingCount: driving,
    stoppedCount: stopped,
    offlineCount: offline,
  };
};

const elements: PluginElementsModule = {
  slug: 'geotab',
  functions: {
    efficiency_tone,
    productivity_tone,
    private_km_tone,
    month_start_iso,
    vehicle_state_tone,
    format_duration_hm,
    fuel_dashboard,
    after_hours_dashboard,
    travel_onsite_dashboard,
    vehicle_status_dashboard,
  },
};

export default elements;
