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

const elements: PluginElementsModule = {
  slug: 'reckon-accounting',
  functions: { company_name, account_summary },
};

export default elements;
