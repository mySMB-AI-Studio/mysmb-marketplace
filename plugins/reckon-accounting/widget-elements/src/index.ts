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

// ── analyze_data_issues ─────────────────────────────────────────────
// Lightweight data-integrity scan across Reckon One contacts, bills, and
// invoices — three checks, each counting the number of DISTINCT
// duplicate GROUPS found (not total records): a reference value, or a
// normalized party name, shared by 2+ records counts as ONE issue
// however many records share it.
//
// Duplicate contacts: Reckon's "Contacts" is broader than the /contacts
// API resource alone (confirmed live, directly from the user: near-
// duplicate test records were created in Reckon's own "Contacts centre"
// UI as CUSTOMER and SUPPLIER records, not as /contacts people) — and
// there is no dedicated /customers or /suppliers list endpoint at all
// (checked Reckon's own canonical API endpoint docs). The only way a
// customer/supplier organization is visible through this API is
// indirectly, embedded as `supplier`/`customer` on a bill/invoice that
// already references it — so the party pool here is the UNION of:
// /contacts people, /contacts' own organisation sub-objects, every
// bill's supplier, and every invoice's customer — deduped by id. A
// duplicate organization with zero bills/invoices against it is
// invisible to this check; that's a real, confirmed API limitation,
// not a bug.
//
// Name matching strips more than whitespace: confirmed live, Reckon
// test duplicates differ only by a trailing period ("Metro Cleaning
// Services" vs "Metro Cleaning Services .", two different ids) — a
// plain trim() leaves the period in place and misses the match, so
// normalization also strips all non-alphanumeric characters, not just
// collapsing whitespace.
//
// Duplicate bill numbers: bills sharing the same non-blank `reference`
// value — NOT Reckon's own `billNumber` (BIL0001, BIL0002, ...), which
// is auto-assigned sequentially by Reckon itself and would essentially
// never collide naturally. `reference` is the free-text field a user
// enters for the SUPPLIER's own invoice number — confirmed live against
// a real test case: two bills from two DIFFERENT suppliers sharing the
// same reference ("INV-4521"), deliberately created to prove `reference`
// is the real duplicate signal here, not `billNumber`.
//
// Inactive-contact activity: /contacts people with status !== "Active"
// whose organisation.id matches a bill's supplier.id or an invoice's
// customer.id — i.e. an inactive contact's organisation still has
// bill/invoice activity on file. Counts flagged CONTACTS, not
// bills/invoices. Bills/invoices reference the ORGANISATION, not the
// contact person directly — confirmed live: a contact's organisation.id
// matched a real bill's supplier.id exactly — so matching must go
// through organisation.id, never the contact's own id.
//
// totalIssues is the sum of the three counts.
// Args: { contacts?: array, bills?: array, invoices?: array }
const analyze_data_issues: ComputedFunction = (args) => {
  const contacts = Array.isArray(args.contacts) ? (args.contacts as Record<string, unknown>[]) : [];
  const bills = Array.isArray(args.bills) ? (args.bills as Record<string, unknown>[]) : [];
  const invoices = Array.isArray(args.invoices) ? (args.invoices as Record<string, unknown>[]) : [];

  // Strips everything but letters/digits/spaces (not just whitespace),
  // so "Metro Cleaning Services ." and "Metro Cleaning Services" both
  // normalize to "metro cleaning services".
  const normName = (s: unknown) =>
    String(s ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, ' ');

  // ── duplicate contacts (by normalized name, across people + orgs) ──
  const parties = new Map<string, string>(); // id -> name
  for (const c of contacts) {
    const id = typeof c.id === 'string' ? c.id : undefined;
    if (id && typeof c.name === 'string') parties.set(id, c.name);
    const org = c.organisation as Record<string, unknown> | undefined;
    if (typeof org?.id === 'string' && typeof org.name === 'string') parties.set(org.id, org.name);
  }
  for (const b of bills) {
    const s = b.supplier as Record<string, unknown> | undefined;
    if (typeof s?.id === 'string' && typeof s.name === 'string') parties.set(s.id, s.name);
  }
  for (const inv of invoices) {
    const c = inv.customer as Record<string, unknown> | undefined;
    if (typeof c?.id === 'string' && typeof c.name === 'string') parties.set(c.id, c.name);
  }

  const nameGroups = new Map<string, { id: string; name: string }[]>();
  for (const [id, name] of parties.entries()) {
    const key = normName(name);
    if (!key) continue;
    if (!nameGroups.has(key)) nameGroups.set(key, []);
    nameGroups.get(key)!.push({ id, name });
  }
  const dupContactGroups = Array.from(nameGroups.values()).filter((members) => members.length > 1);
  const duplicateContacts = dupContactGroups.length;
  const duplicateContactsDetail = dupContactGroups.flatMap((members, i) =>
    members.map((m) => ({ id: m.id, name: m.name, groupIndex: i })),
  );

  // ── duplicate bill numbers (by non-blank reference) ────────────────
  const refGroups = new Map<string, Record<string, unknown>[]>();
  for (const b of bills) {
    const ref = typeof b.reference === 'string' ? b.reference.trim() : '';
    if (!ref) continue;
    if (!refGroups.has(ref)) refGroups.set(ref, []);
    refGroups.get(ref)!.push(b);
  }
  const dupBillGroups = Array.from(refGroups.entries()).filter(([, rows]) => rows.length > 1);
  const duplicateBillNumbers = dupBillGroups.length;
  const duplicateBillNumbersDetail = dupBillGroups.flatMap(([ref, rows], i) =>
    rows.map((b) => ({
      id: String(b.id ?? ''),
      billNumber: String(b.billNumber ?? ''),
      reference: ref,
      supplier: String((b.supplier as Record<string, unknown> | undefined)?.name ?? ''),
      totalAmount: Number(b.totalAmount ?? 0),
      groupIndex: i,
    })),
  );

  // ── inactive-contact activity ──────────────────────────────────────
  const activeOrgIds = new Set<string>();
  for (const b of bills) {
    const id = (b.supplier as Record<string, unknown> | undefined)?.id;
    if (typeof id === 'string') activeOrgIds.add(id);
  }
  for (const inv of invoices) {
    const id = (inv.customer as Record<string, unknown> | undefined)?.id;
    if (typeof id === 'string') activeOrgIds.add(id);
  }
  const inactiveContactActivityDetail: { id: string; name: string; organisation: string }[] = [];
  for (const c of contacts) {
    if (String(c.status ?? '') === 'Active') continue;
    const org = c.organisation as Record<string, unknown> | undefined;
    const orgId = org?.id;
    if (typeof orgId === 'string' && activeOrgIds.has(orgId)) {
      inactiveContactActivityDetail.push({
        id: String(c.id ?? ''),
        name: String(c.name ?? ''),
        organisation: String(org?.name ?? ''),
      });
    }
  }
  const inactiveContactActivity = inactiveContactActivityDetail.length;

  return {
    totalIssues: duplicateContacts + duplicateBillNumbers + inactiveContactActivity,
    duplicateContacts,
    duplicateBillNumbers,
    inactiveContactActivity,
    duplicateContactsDetail,
    duplicateBillNumbersDetail,
    inactiveContactActivityDetail,
  };
};

const elements: PluginElementsModule = {
  slug: 'reckon-accounting',
  functions: { company_name, account_summary, days_ago, abs_balance, analyze_data_issues },
};

export default elements;
