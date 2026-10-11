/**
 * reckon-accounting — widget-elements module
 * ──────────────────────────────────────────────────────────────────
 * Connector-specific `$computed` helpers contributed to the host's
 * widgets-system at runtime. The host prepends the slug
 * `reckon-accounting_` to every name in `functions`, so e.g. the spec-side
 * reference is `reckon-accounting_company_name`.
 *
 * Reckon's public API docs (developer.reckon.com / help.reckon.com) confirm
 * the endpoint list and OAuth flow, but not the exact JSON field names each
 * endpoint returns. Both functions below parse defensively — trying several
 * plausible key spellings — rather than assuming one, and are written to
 * degrade to an empty/zero result instead of throwing when the shape
 * doesn't match what was guessed. Tighten these once a real cashbook's
 * responses have been inspected.
 */

import type { ComputedFunction, PluginElementsModule } from './types';

// ── company_name ──────────────────────────────────────────────────────
// Extracts a display name from a GET /company response, trying the common
// REST spellings a company/profile resource tends to use.
// Args: { value: object }
const company_name: ComputedFunction = (args) => {
  const r = args.value as Record<string, unknown> | undefined;
  if (!r || typeof r !== 'object') return '';
  const candidates = [
    r.name, r.companyName, r.businessName, r.tradingName,
    r.Name, r.CompanyName, r.BusinessName, r.TradingName,
  ];
  const hit = candidates.find((v) => typeof v === 'string' && v.length > 0);
  return typeof hit === 'string' ? hit : '';
};

// ── account_summary ────────────────────────────────────────────────────
// Summarizes a GET /accounts response into a guaranteed-shape object so the
// widget spec never has to bind directly to an unconfirmed raw field name.
// Handles the response arriving as a bare array or wrapped under a common
// list-container key (accounts / items / data).
// Returns { totalAccounts: number, byType: [{ type: string, count: number }] }
// (byType sorted by count desc; entries with no recognizable type key are
// grouped under "Other")
// Args: { value: object | array }
const account_summary: ComputedFunction = (args) => {
  const raw = args.value as Record<string, unknown> | unknown[] | undefined;
  const list: Record<string, unknown>[] = Array.isArray(raw)
    ? (raw as Record<string, unknown>[])
    : Array.isArray((raw as Record<string, unknown>)?.accounts)
      ? ((raw as Record<string, unknown>).accounts as Record<string, unknown>[])
      : Array.isArray((raw as Record<string, unknown>)?.items)
        ? ((raw as Record<string, unknown>).items as Record<string, unknown>[])
        : Array.isArray((raw as Record<string, unknown>)?.data)
          ? ((raw as Record<string, unknown>).data as Record<string, unknown>[])
          : [];

  const counts = new Map<string, number>();
  for (const account of list) {
    const type = account.type ?? account.accountType ?? account.Type ?? account.AccountType ?? account.classification;
    const key = typeof type === 'string' && type.length > 0 ? type : 'Other';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const byType = Array.from(counts.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  return { totalAccounts: list.length, byType };
};

// ── days_ago ─────────────────────────────────────────────────────────
// Today (UTC midnight), shifted by `days` days — a real resolved ISO
// instant usable as a `filter_date_range` start/end boundary. Negative
// `days` shifts into the future (e.g. -3650 for "no practical upper
// bound"). Needed because the system's `$days_ago_30`-style magic tokens
// only resolve inside tool-call params (list_invoices' own dataProvider
// params, an action's params), never inside a $computed expression
// evaluated client-side — there is no other way to get a real "N days
// from today" date boundary for aging-bucket math.
//
// Deliberately UTC, not local midnight: a bare `YYYY-MM-DD` due date (e.g.
// Reckon's `dueDate`) gets parsed elsewhere (filter_date_range's
// parseInstant) as UTC midnight, since it appends "Z" rather than
// interpreting the string in the viewer's timezone. Computing this
// boundary from LOCAL midnight instead — as an earlier version did —
// skews every cutoff by the server's UTC offset: confirmed live, a bill
// due exactly 6 days out fell into "due later" instead of "due this week"
// because local midnight landed hours earlier than the UTC midnight the
// due date itself parses to.
// Args: { days: number }
const days_ago: ComputedFunction = (args) => {
  const n = Number(args.days);
  const days = Number.isFinite(n) ? n : 0;
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
};

// ── abs_balance ──────────────────────────────────────────────────────
// Returns a copy of a bills/invoices array with `balance` normalized to
// its absolute value. Confirmed live: GET /bills returns balance as a
// NEGATIVE number (e.g. -820 for an $820 unpaid bill) — the opposite
// sign convention from GET /invoices, where balance is positive for the
// same "amount still owed" meaning. Normalizing once here, at the point
// the raw list first enters widget state, means every sum/format call
// downstream can treat balance as a plain positive amount without each
// one needing its own sign-correction.
// Args: { value: array }
const abs_balance: ComputedFunction = (args) => {
  const arr = args.value;
  if (!Array.isArray(arr)) return [];
  return arr.map((row) => {
    if (!row || typeof row !== 'object') return row;
    const r = row as Record<string, unknown>;
    const n = Number(r.balance);
    return Number.isFinite(n) ? { ...r, balance: Math.abs(n) } : row;
  });
};

const elements: PluginElementsModule = {
  slug: 'reckon-accounting',
  functions: { company_name, account_summary, days_ago, abs_balance },
};

export default elements;
