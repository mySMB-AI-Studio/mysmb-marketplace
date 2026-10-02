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
 * relationship fields fully inlined with a `.name`, not just an id. Used by
 * the `Get`-backed dashboards below (Trip / FuelTransaction records), which
 * still return this nested shape. `get_vehicle_geofence_status` (the
 * dedicated geofence tool) returns `deviceId`/`deviceName` as flat top-level
 * fields instead — see `vehicle_geofence_dashboard`, which doesn't use this
 * helper.
 */
function deviceIdAndLabel(entity: Record<string, unknown>): { id: string; label: string } {
  const dev = entity.device as Record<string, unknown> | undefined;
  const id = typeof dev?.id === 'string' ? dev.id : '';
  const name = typeof dev?.name === 'string' ? dev.name : '';
  return { id, label: name || id || 'Unknown vehicle' };
}

// ── Format helpers ──────────────────────────────────────────────────────

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
 * calendar days).
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
 * afterHoursDistance / workDistance / afterHoursStart|End. Args: { trips: Trip[] }
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
const vehicle_geofence_dashboard: ComputedFunction = (args) => {
  const statuses = Array.isArray(args.statuses) ? (args.statuses as Record<string, unknown>[]) : [];

  const order: Record<string, number> = { 'on-site': 0, 'in-transit': 1, offline: 2 };
  const labelFor: Record<string, string> = {
    'on-site': 'On Site',
    'in-transit': 'In Transit',
    offline: 'Offline',
  };

  let onSite = 0, inTransit = 0, offline = 0;

  const rows = statuses
    .map((s) => {
      const classification = ['on-site', 'in-transit', 'offline'].includes(String(s.classification))
        ? (String(s.classification) as 'on-site' | 'in-transit' | 'offline')
        : 'offline';
      if (classification === 'on-site') onSite += 1;
      else if (classification === 'in-transit') inTransit += 1;
      else offline += 1;

      const deviceName = typeof s.deviceName === 'string' && s.deviceName ? s.deviceName : 'Unknown vehicle';
      const zoneName = typeof s.zoneName === 'string' && s.zoneName ? s.zoneName : '';
      const caption =
        classification === 'on-site'
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

// ── Chart tiles ─────────────────────────────────────────────────────────
//
// Each tile below calls one dashboard function from its card `watch`; the
// per-entity aggregations above are reused rather than duplicated.

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun, as Date#getDay indices
const WEEKDAY_LABEL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Builds a segmented bar out of a `template`d Row of full ProgressBars: the
 * row's `grid-template-columns` sizes each segment proportionally. Zero
 * segments are dropped from the template AND flagged hidden, so the visible
 * children line up with the columns (a 0fr column would still take a gap).
 */
function splitBar(parts: { key: string; value: number }[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const cols: string[] = [];
  for (const p of parts) {
    const v = Math.max(0, Math.round(p.value));
    out[`show_${p.key}`] = v > 0;
    if (v > 0) cols.push(`minmax(0, ${v}fr)`);
  }
  out.template = cols.join(' ');
  return out;
}

const classificationDotTone: Record<string, string> = {
  'on-site': 'success',
  'in-transit': 'info',
  offline: 'warning',
};

/**
 * Vehicles On Site Now — vehicle_geofence_dashboard plus Donut segments
 * and a per-row dot tone. Args: { statuses: VehicleGeofenceStatus[] }
 */
const fleet_snapshot_dashboard: ComputedFunction = (args) => {
  const base = vehicle_geofence_dashboard(args) as {
    rows: { classification: string }[];
    totalCount: number;
    onSiteCount: number;
    inTransitCount: number;
    offlineCount: number;
  };
  return {
    ...base,
    rows: base.rows.map((r) => ({ ...r, dotTone: classificationDotTone[r.classification] ?? 'muted' })),
    segments: [
      { label: 'On site', value: base.onSiteCount, tone: 'success' },
      { label: 'In transit', value: base.inTransitCount, tone: 'info' },
      { label: 'Offline', value: base.offlineCount, tone: 'warning' },
    ],
  };
};

/**
 * Travel vs On-Site Time — Trip.stopDuration is documented as including
 * idling time, so on-site time = stopDuration − idlingDuration, kept separate
 * from idle. Grouped by DEVICE, not driver. Keeps each vehicle's three minute
 * totals so every row can draw its own on-site / travel / idle segmented bar.
 * Args: { trips: Trip[] }
 */
const time_split_dashboard: ComputedFunction = (args) => {
  const trips = Array.isArray(args.trips) ? (args.trips as Record<string, unknown>[]) : [];

  const byDevice = new Map<string, { label: string; travel: number; onSite: number; idle: number }>();
  for (const t of trips) {
    const { id, label } = deviceIdAndLabel(t);
    if (!id) continue;
    const stop = durationToMinutes(t.stopDuration);
    const idle = durationToMinutes(t.idlingDuration);
    const cur = byDevice.get(id) ?? { label, travel: 0, onSite: 0, idle: 0 };
    cur.travel += durationToMinutes(t.drivingDuration);
    cur.onSite += Math.max(0, stop - idle);
    cur.idle += idle;
    byDevice.set(id, cur);
  }

  const hm = (minutes: number) => format_duration_hm({ minutes }) as string;
  const pctOf = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

  let onSite = 0, travel = 0, idle = 0;
  const rows = [...byDevice.entries()]
    .map(([id, v]) => {
      onSite += v.onSite;
      travel += v.travel;
      idle += v.idle;
      const total = v.onSite + v.travel + v.idle;
      return {
        deviceId: id,
        deviceName: v.label,
        productivePercent: pctOf(v.onSite, total),
        summary: `${hm(v.onSite)} on site · ${hm(v.travel)} travel · ${hm(v.idle)} idle`,
        bar: splitBar([
          { key: 'onSite', value: v.onSite },
          { key: 'travel', value: v.travel },
          { key: 'idle', value: v.idle },
        ]),
      };
    })
    .sort((a, b) => b.productivePercent - a.productivePercent)
    .slice(0, 20);

  const total = onSite + travel + idle;
  return {
    rows,
    vehicleCount: byDevice.size,
    onSiteText: hm(onSite),
    travelText: hm(travel),
    idleText: hm(idle),
    onSitePercent: pctOf(onSite, total),
    travelPercent: pctOf(travel, total),
    idlePercent: pctOf(idle, total),
    bar: splitBar([
      { key: 'onSite', value: onSite },
      { key: 'travel', value: travel },
      { key: 'idle', value: idle },
    ]),
  };
};

/**
 * After-Hours & Private Use — sums Trip.afterHoursDistance (km) by the
 * local weekday of Trip.start, Mon..Sun, for a "by day" bar strip, plus the
 * top vehicles for a BarChart. Args: { trips: Trip[] }
 */
const after_hours_weekday_dashboard: ComputedFunction = (args) => {
  const trips = Array.isArray(args.trips) ? (args.trips as Record<string, unknown>[]) : [];

  const kmByDay = new Map<number, number>();
  const tripsByDay = new Map<number, number>();
  for (const t of trips) {
    const km = Number(t.afterHoursDistance ?? 0);
    if (!(km > 0)) continue;
    const ts = Date.parse(String(t.start ?? ''));
    if (Number.isNaN(ts)) continue;
    const day = new Date(ts).getDay();
    kmByDay.set(day, (kmByDay.get(day) ?? 0) + km);
    tripsByDay.set(day, (tripsByDay.get(day) ?? 0) + 1);
  }

  const maxKm = Math.max(0, ...kmByDay.values());
  const totalKm = [...kmByDay.values()].reduce((a, b) => a + b, 0);
  const weekendKm = (kmByDay.get(0) ?? 0) + (kmByDay.get(6) ?? 0);

  // -1 = no after-hours km at all (kmByDay.get(-1) reads as 0).
  const peakDay = WEEKDAY_ORDER.reduce(
    (best, d) => ((kmByDay.get(d) ?? 0) > (kmByDay.get(best) ?? 0) ? d : best),
    -1,
  );

  const days = WEEKDAY_ORDER.map((d) => {
    const km = kmByDay.get(d) ?? 0;
    const n = tripsByDay.get(d) ?? 0;
    return {
      key: WEEKDAY_LABEL[d],
      dayLabel: WEEKDAY_LABEL[d],
      kmText: km > 0 ? `${Math.round(km)} km` : '–',
      tripsText: n > 0 ? `${n} trip${n === 1 ? '' : 's'}` : '–',
      pct: maxKm > 0 ? Math.round((km / maxKm) * 100) : 0,
      isPeak: d === peakDay,
      tone: d === peakDay ? 'warning' : 'info',
    };
  });

  // Top vehicles reuse the original per-device ranking.
  const base = after_hours_dashboard(args) as { rows: { deviceName: string; afterHoursKm: number }[]; flagNote: string };

  return {
    days,
    vehicles: base.rows.slice(0, 5),
    totalKm: Math.round(totalKm),
    weekendPercent: totalKm > 0 ? Math.round((weekendKm / totalKm) * 100) : 0,
    peakDayLabel: peakDay >= 0 ? WEEKDAY_LABEL[peakDay] : '–',
    flagNote: base.flagNote,
  };
};

/**
 * Fuel & Efficiency — litres per calendar day for the last 7 days (oldest
 * first, for a chronological BarChart) plus MTD litres split by vehicle
 * (top 4 + "Other") for a Donut. Fleet-average efficiency still comes from
 * fuel_dashboard. Args: { transactions: FuelTransaction[], monthStartIso: string }
 */
const fuel_daily_dashboard: ComputedFunction = (args) => {
  const transactions = Array.isArray(args.transactions) ? (args.transactions as Record<string, unknown>[]) : [];
  const monthStart = String(args.monthStartIso ?? '');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const daily: { key: string; label: string; litres: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    daily.push({ key: dayKey(d), label: `${WEEKDAY_LABEL[d.getDay()]} ${d.getDate()}`, litres: 0 });
  }
  const dailyByKey = new Map(daily.map((d) => [d.key, d]));

  const mtdByDevice = new Map<string, { label: string; litres: number }>();
  let mtdLitres = 0;
  for (const t of transactions) {
    const volume = Number(t.volume ?? 0);
    if (!(volume > 0)) continue;
    const ts = Date.parse(String(t.dateTime ?? ''));
    if (!Number.isNaN(ts)) {
      const bucket = dailyByKey.get(dayKey(new Date(ts)));
      if (bucket) bucket.litres += volume;
    }
    if (String(t.dateTime ?? '') >= monthStart) {
      mtdLitres += volume;
      const { id, label } = deviceIdAndLabel(t);
      const cur = mtdByDevice.get(id || label) ?? { label, litres: 0 };
      cur.litres += volume;
      mtdByDevice.set(id || label, cur);
    }
  }

  const ranked = [...mtdByDevice.values()].sort((a, b) => b.litres - a.litres);
  const tones = ['chart-1', 'chart-2', 'chart-3', 'chart-4'];
  const segments = ranked.slice(0, 4).map((v, i) => ({ label: v.label, value: Math.round(v.litres), tone: tones[i] }));
  const otherLitres = ranked.slice(4).reduce((a, v) => a + v.litres, 0);
  if (otherLitres > 0) segments.push({ label: 'Other vehicles', value: Math.round(otherLitres), tone: 'muted' });

  const base = fuel_dashboard(args) as {
    rows: { deviceName: string; l100km: number }[];
    totalCost: number;
    fleetAvgL100km: number;
    outlierNote: string;
  };
  const weekLitres = daily.reduce((a, d) => a + d.litres, 0);

  return {
    daily: daily.map((d) => ({ ...d, litres: Math.round(d.litres) })),
    weekLitres: Math.round(weekLitres),
    mtdLitres: Math.round(mtdLitres),
    segments,
    efficiency: base.rows.slice(0, 5),
    totalCost: base.totalCost,
    fleetAvgL100km: base.fleetAvgL100km,
    outlierNote: base.outlierNote,
  };
};

const elements: PluginElementsModule = {
  slug: 'geotab-direct',
  functions: {
    month_start_iso,
    fleet_snapshot_dashboard,
    time_split_dashboard,
    after_hours_weekday_dashboard,
    fuel_daily_dashboard,
  },
};

export default elements;
