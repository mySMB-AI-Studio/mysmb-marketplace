/**
 * xero-accounting — widget-elements module
 * ──────────────────────────────────────────────────────────────────
 * Connector-specific `$computed` helpers contributed to the host's
 * widgets-system at runtime. The host prepends the slug `xero-accounting_`
 * to every name in `functions`, so e.g. the spec-side reference is
 * `xero-accounting_format_date`.
 *
 * Helpers here only make sense for Xero payloads (Microsoft-JSON dates,
 * Xero status enums, Xero report-tree shape).
 */

import type { ComputedFunction, PluginElementsModule } from './types';

// Internal: parse any value Xero might give us as a "date-ish" into epoch ms.
function toEpochMs(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') return raw;
  if (typeof raw !== 'string') return null;
  const m = raw.match(/\/Date\((-?\d+)([+-]\d{4})?\)\//);
  if (m) return Number(m[1]);
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

// ── format_date ──────────────────────────────────────────────────────
// Xero returns dates as `/Date(1772150400000+0000)/` (Microsoft JSON
// date format). This extracts the epoch millis and formats as a short
// human-readable date.
//
// Args: { value: string | number, format?: 'short'|'medium'|'long'|'iso' }
const format_date: ComputedFunction = (args) => {
  const raw = args.value;
  const format = (args.format as string) || 'short';
  if (raw == null) return '';

  const ms = toEpochMs(raw);
  if (ms == null) return String(raw);

  const d = new Date(ms);
  if (format === 'iso') return d.toISOString().slice(0, 10);
  if (format === 'long') {
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
  if (format === 'medium') {
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
  return d.toLocaleDateString(undefined, {
    year: '2-digit',
    month: 'short',
    day: 'numeric',
  });
};

// ── status_tone ──────────────────────────────────────────────────────
// Map Xero status strings to our semantic tone palette.
// Args: { value: string }
const status_tone: ComputedFunction = (args) => {
  const s = String(args.value ?? '').toUpperCase();
  if (s === 'PAID' || s === 'AUTHORISED') return 'success';
  if (s === 'DRAFT') return 'muted';
  if (s === 'SUBMITTED') return 'info';
  if (s === 'VOIDED' || s === 'DELETED') return 'destructive';
  return 'default';
};

// ── status_label ─────────────────────────────────────────────────────
// TILE-DISPLAY-STANDARDS.md §3: never pass a raw connector enum straight
// to a Badge — Title Case the Xero status string (e.g. "AUTHORISED" →
// "Authorised") rather than showing the raw SCREAMING_CASE enum. Tone
// alone (status_tone) only controls color, not casing.
const status_label: ComputedFunction = (args) => {
  const s = String(args.value ?? '');
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
};

// ── bank_tx_icon ─────────────────────────────────────────────────────
// Lucide icon name for a bank-transaction Type. RECEIVE* → down-arrow,
// SPEND* → up-arrow, anything else → neutral receipt.
const bank_tx_icon: ComputedFunction = (args) => {
  const t = String(args.value ?? '');
  if (t.startsWith('RECEIVE')) return 'ArrowDownCircle';
  if (t.startsWith('SPEND')) return 'ArrowUpCircle';
  return 'Receipt';
};

// ── bank_tx_tone ─────────────────────────────────────────────────────
// Tone for a bank-transaction row.
const bank_tx_tone: ComputedFunction = (args) => {
  const t = String(args.value ?? '');
  if (t.startsWith('RECEIVE')) return 'success';
  if (t.startsWith('SPEND')) return 'destructive';
  return 'muted';
};

// ── bank_tx_label ────────────────────────────────────────────────────
// TILE-DISPLAY-STANDARDS.md §3: never show a raw connector enum. Xero's
// real Type values include suffixed variants (SPEND-OVERPAYMENT,
// RECEIVE-TRANSFER, etc.) — this collapses all of them to the plain
// direction word, same grouping bank_tx_icon/bank_tx_tone already use.
const bank_tx_label: ComputedFunction = (args) => {
  const t = String(args.value ?? '');
  if (t.startsWith('RECEIVE')) return 'Receive';
  if (t.startsWith('SPEND')) return 'Spend';
  return t;
};

// ── reconciliation_breakdown ─────────────────────────────────────────
// Reconciled/unreconciled is a real binary status (TILE-DISPLAY-STANDARDS.md
// §7's restraint model applies, not the categorical chart palette) —
// "success" always means done/paid/completed, matching a reconciled
// transaction; "warning" for unreconciled since it's a real pending
// action item, not a no-news-is-good-news default.
// Args: { transactions: array }
// Returns: { total, reconciled, unreconciled, segments: [{ status, count, tone }], template }
const reconciliation_breakdown: ComputedFunction = (args) => {
  const transactions = Array.isArray(args.transactions) ? (args.transactions as Record<string, unknown>[]) : [];
  const reconciled = transactions.filter((t) => t.IsReconciled === true).length;
  const unreconciled = transactions.length - reconciled;

  const segments = [
    { status: 'Reconciled', count: reconciled, tone: 'success' },
    { status: 'Unreconciled', count: unreconciled, tone: 'warning' },
  ].filter((s) => s.count > 0);

  return {
    total: transactions.length,
    reconciled,
    unreconciled,
    segments,
    template: segments.length ? segments.map((s) => `${s.count}fr`).join(' ') : '1fr',
  };
};

// Supplier is a portal-defined, open-ended label with no inherent
// good/bad meaning — a categorical (non-status) case per
// TILE-DISPLAY-STANDARDS.md §7, so it gets the `chart-1..5` palette.
// Only the top 5 suppliers by total amount paid get a distinct color;
// everyone else falls back to `muted` rather than reusing a color,
// which would falsely imply they're grouped with a top-5 supplier.
const REMITTANCE_CHART_TONES = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'];

function rankSuppliersByTotalPaid(payments: Record<string, unknown>[]): Map<string, string> {
  const totals = new Map<string, number>();
  for (const payment of payments) {
    const invoice = payment.Invoice as { Contact?: { Name?: string } } | undefined;
    const supplier = invoice?.Contact?.Name || 'Unknown supplier';
    const amount = Number(payment.Amount) || 0;
    totals.set(supplier, (totals.get(supplier) ?? 0) + amount);
  }
  const toneBySupplier = new Map<string, string>();
  [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([supplier], i) => {
      toneBySupplier.set(supplier, i < REMITTANCE_CHART_TONES.length ? REMITTANCE_CHART_TONES[i] : 'muted');
    });
  return toneBySupplier;
}

/**
 * Flattens a `list_payments` response (already filtered to
 * PaymentType=="ACCPAYPAYMENT") into rows for the Remittance tile — an
 * approximation of Xero's own remittance advice document (which invoices
 * were paid, to whom, how much, when), since Xero's public API has no
 * dedicated remittance-advice resource of its own.
 *
 * Each row carries `supplierTone` (chart-1..5 for the top 5 suppliers by
 * total amount paid, muted for the rest) so a row's supplier badge and
 * `xero-accounting_remittance_breakdown`'s bar segment for that same
 * supplier always share one color — the breakdown function reads this
 * same field rather than re-ranking independently.
 *
 * Args: { payments: array }
 * Returns: array of { id, supplier, supplierTone, invoiceId, invoiceNumber, amount, currencyCode, date }
 *
 * Spec example:
 *   {
 *     "$computed": "xero-accounting_remittance_rows",
 *     "args": { "payments": { "$state": "/xero-accounting/list_payments/Payments" } }
 *   }
 */
const remittance_rows: ComputedFunction = (args) => {
  const payments = Array.isArray(args.payments) ? (args.payments as Record<string, unknown>[]) : [];
  const toneBySupplier = rankSuppliersByTotalPaid(payments);

  return payments.map((payment) => {
    const invoice = payment.Invoice as
      | { InvoiceID?: string; InvoiceNumber?: string; Contact?: { Name?: string } }
      | undefined;
    const account = payment.Account as { CurrencyCode?: string } | undefined;
    const supplier = invoice?.Contact?.Name || 'Unknown supplier';

    return {
      id: payment.PaymentID,
      supplier,
      supplierTone: toneBySupplier.get(supplier) ?? 'muted',
      invoiceId: invoice?.InvoiceID ?? null,
      invoiceNumber: invoice?.InvoiceNumber || '—',
      amount: Number(payment.Amount) || 0,
      currencyCode: account?.CurrencyCode || 'AUD',
      date: payment.Date ?? null,
    };
  });
};

/**
 * Groups Remittance rows (from `xero-accounting_remittance_rows`) into a
 * top-5-suppliers-by-amount-paid breakdown, reading each row's
 * already-assigned `supplierTone` rather than re-ranking, so the bar's
 * segment colors always match the row badges for the same supplier.
 * Segment width is proportional to amount paid (not row count), so the
 * bar visually communicates "who got paid the most", not just "who has
 * the most transactions".
 *
 * Args: { rows: array }
 * Returns: { total, segments: [{ supplier, amount, tone }], template }
 *
 * Spec example:
 *   {
 *     "$computed": "xero-accounting_remittance_breakdown",
 *     "args": { "rows": { "$state": "/ui/rows" } }
 *   }
 */
const remittance_breakdown: ComputedFunction = (args) => {
  const rows = Array.isArray(args.rows) ? (args.rows as Record<string, unknown>[]) : [];

  const totals = new Map<string, { supplier: string; amount: number; tone: string }>();
  for (const row of rows) {
    const supplier = typeof row.supplier === 'string' && row.supplier ? row.supplier : 'Unknown supplier';
    const entry = totals.get(supplier) ?? { supplier, amount: 0, tone: (row.supplierTone as string) ?? 'muted' };
    entry.amount += Number(row.amount) || 0;
    totals.set(supplier, entry);
  }

  const segments = [...totals.values()]
    .filter((s) => s.tone !== 'muted')
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  return {
    total: rows.length,
    segments,
    template: segments.length ? segments.map((s) => `${Math.max(1, Math.round(s.amount))}fr`).join(' ') : '1fr',
  };
};

/**
 * Flattens a `list_receipts` response (already filtered to Status=="DRAFT")
 * into rows for the Reimbursement Drafts tile. A Receipt is the Xero
 * object an employee fills in before it's grouped into an ExpenseClaim
 * for approval — "DRAFT" only exists at this level (ExpenseClaim itself
 * starts at SUBMITTED), so this is genuinely "things not yet submitted
 * for reimbursement", not an approximation.
 *
 * `isEmpty` flags a receipt with no line items / zero total — i.e.
 * someone started it in Xero and never finished — which is the real
 * actionable signal for this tile (a stale, abandoned draft vs. one
 * that's filled in and just needs submitting).
 *
 * Args: { receipts: array }
 * Returns: array of { id, userName, payee, amount, currencyCode, lineItemCount, isEmpty, updatedDate }
 */
const reimbursement_draft_rows: ComputedFunction = (args) => {
  const receipts = Array.isArray(args.receipts) ? (args.receipts as Record<string, unknown>[]) : [];

  return receipts.map((receipt) => {
    const user = receipt.User as { FirstName?: string; LastName?: string } | undefined;
    const contact = receipt.Contact as { Name?: string } | undefined;
    const lineItems = Array.isArray(receipt.LineItems) ? receipt.LineItems : [];
    const total = Number(receipt.Total) || 0;

    const userName = [user?.FirstName, user?.LastName].filter(Boolean).join(' ') || 'Unknown';

    return {
      id: receipt.ReceiptID,
      userName,
      payee: contact?.Name || '—',
      amount: total,
      currencyCode: (receipt.CurrencyCode as string) || 'AUD',
      lineItemCount: lineItems.length,
      isEmpty: lineItems.length === 0 && total === 0,
      updatedDate: receipt.UpdatedDateUTC ?? null,
    };
  });
};

// ── flatten_report_rows ──────────────────────────────────────────────
// Walks a Xero Report tree (`Reports[0].Rows`) and returns a flat list
// of `{ title, rowType, depth, sectionTitle, c0..c4 }` objects suitable
// for a Table. Skips Header rows by default.
interface FlatReportRow {
  title: string;
  rowType: string;
  depth: number;
  sectionTitle: string;
  [cell: string]: unknown;
}
const flatten_report_rows: ComputedFunction = (args) => {
  const include = Array.isArray(args.includeTypes)
    ? new Set((args.includeTypes as string[]).map(String))
    : new Set(['Row', 'SummaryRow']);
  const src = args.value;
  const rows: unknown = Array.isArray(src)
    ? src
    : (src as { Rows?: unknown })?.Rows ??
      (src as { Reports?: Array<{ Rows?: unknown }> })?.Reports?.[0]?.Rows ??
      [];
  if (!Array.isArray(rows)) return [];
  const out: FlatReportRow[] = [];
  const walk = (
    list: Array<Record<string, unknown>>,
    depth: number,
    sectionTitle: string,
  ): void => {
    for (const r of list) {
      if (!r || typeof r !== 'object') continue;
      const rowType = String(r.RowType ?? '');
      const title = String(r.Title ?? '');
      const cells = Array.isArray(r.Cells) ? (r.Cells as Array<{ Value?: unknown }>) : null;
      if (rowType === 'Section' && Array.isArray(r.Rows)) {
        walk(r.Rows as Array<Record<string, unknown>>, depth + 1, title || sectionTitle);
        continue;
      }
      if (!include.has(rowType)) continue;
      const flat: FlatReportRow = {
        title: cells?.[0]?.Value != null ? String(cells[0].Value) : title,
        rowType,
        depth,
        sectionTitle,
      };
      if (cells) {
        cells.forEach((cell, idx) => {
          flat[`c${idx}`] = cell?.Value ?? '';
        });
      }
      out.push(flat);
    }
  };
  walk(rows as Array<Record<string, unknown>>, 0, '');
  return out;
};

// ── report_find_row ──────────────────────────────────────────────────
// Find a specific row in a flattened-report array by case-insensitive
// title match, return its cell `cN` value as a number (or 0).
const report_find_row: ComputedFunction = (args) => {
  const arr = args.value;
  if (!Array.isArray(arr)) return 0;
  const want = String(args.title ?? '').toLowerCase();
  const cellIdx = typeof args.cell === 'number' ? (args.cell as number) : 1;
  const row = arr.find((r) => {
    const t = String((r as Record<string, unknown>)?.title ?? '').toLowerCase();
    return t === want || t.includes(want);
  }) as Record<string, unknown> | undefined;
  if (!row) return 0;
  const raw = row[`c${cellIdx}`];
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
};

// ── po_status_tone ───────────────────────────────────────────────────
// Tone for a Xero PurchaseOrder.Status value.
const po_status_tone: ComputedFunction = (args) => {
  const s = String(args.value ?? '').toUpperCase();
  if (s === 'DRAFT') return 'muted';
  if (s === 'SUBMITTED') return 'info';
  if (s === 'AUTHORISED') return 'warning';
  if (s === 'BILLED') return 'success';
  if (s === 'DELETED') return 'destructive';
  return 'default';
};

// ── quote_status_tone ────────────────────────────────────────────────
// Tone for a Xero Quote.Status value.
const quote_status_tone: ComputedFunction = (args) => {
  const s = String(args.value ?? '').toUpperCase();
  if (s === 'DRAFT') return 'muted';
  if (s === 'SENT') return 'info';
  if (s === 'ACCEPTED') return 'success';
  if (s === 'INVOICED') return 'success';
  if (s === 'DECLINED') return 'destructive';
  return 'default';
};

// ── this_month_range ─────────────────────────────────────────────────
// Date range for the current calendar month, in ISO (yyyy-mm-dd).
const this_month_range: ComputedFunction = () => {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    fromDate: from.toISOString().slice(0, 10),
    toDate: to.toISOString().slice(0, 10),
  };
};

// ── prev_month_range ─────────────────────────────────────────────────
// Date range for the previous calendar month, in ISO.
const prev_month_range: ComputedFunction = () => {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const to = new Date(now.getFullYear(), now.getMonth(), 0);
  return {
    fromDate: from.toISOString().slice(0, 10),
    toDate: to.toISOString().slice(0, 10),
  };
};

// ── next_n_days ──────────────────────────────────────────────────────
// Date range from today to N days ahead, inclusive.
const next_n_days: ComputedFunction = (args) => {
  const n = typeof args.n === 'number' ? (args.n as number) : 30;
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from.getTime() + n * 24 * 60 * 60 * 1000);
  return {
    fromDate: from.toISOString().slice(0, 10),
    toDate: to.toISOString().slice(0, 10),
  };
};

// ── days_overdue ─────────────────────────────────────────────────────
// Days since a due date — positive past due, negative still upcoming.
const days_overdue: ComputedFunction = (args) => {
  const ms = toEpochMs(args.value);
  if (ms == null) return 0;
  const day = 24 * 60 * 60 * 1000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(ms);
  due.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - due.getTime()) / day);
};

// ── overdue_label ────────────────────────────────────────────────────
// "12d overdue" / "due today" / "due in 5d".
const overdue_label: ComputedFunction = (args) => {
  const n = Number(days_overdue({ value: args.value }));
  if (!Number.isFinite(n)) return '';
  if (n === 0) return 'due today';
  if (n > 0) return `${n}d overdue`;
  return `due in ${-n}d`;
};

// ── overdue_tone ─────────────────────────────────────────────────────
// Tone for an overdue badge. <=0 muted, <=30 warning, >30 destructive.
const overdue_tone: ComputedFunction = (args) => {
  const n = Number(days_overdue({ value: args.value }));
  if (!Number.isFinite(n) || n <= 0) return 'muted';
  if (n <= 30) return 'warning';
  return 'destructive';
};

// ── overdue_only ─────────────────────────────────────────────────────
// Return only the invoices whose DueDate is in the past (daysOverdue > 0).
// Used by chase/collections widgets that want to exclude not-yet-due
// invoices from the AUTHORISED list.
// Args: { value: Invoice[] }
const overdue_only: ComputedFunction = (args) => {
  const arr = args.value;
  if (!Array.isArray(arr)) return [];
  return arr.filter((inv) => {
    const due = (inv as { DueDate?: unknown })?.DueDate;
    const n = Number(days_overdue({ value: due }));
    return Number.isFinite(n) && n > 0;
  });
};

// ── age_buckets ──────────────────────────────────────────────────────
// Aggregate a list of invoices into the 5 standard aging buckets.
// Returns a fixed-order array — always 5 entries, even buckets with no
// invoices — so the widget can render a stable shape:
//   [{ key: 'Current', total, count, tone },
//    { key: '1-30',    total, count, tone },
//    { key: '31-60',   total, count, tone },
//    { key: '61-90',   total, count, tone },
//    { key: '90+',     total, count, tone }]
// `tone` matches our semantic palette so the widget can colour each row.
// Args: { value: Invoice[] }
const age_buckets: ComputedFunction = (args) => {
  const arr = args.value;
  const tones = {
    Current: 'success',
    '1-30': 'info',
    '31-60': 'warning',
    '61-90': 'destructive',
    '90+': 'destructive',
  } as const;
  const order: Array<keyof typeof tones> = ['Current', '1-30', '31-60', '61-90', '90+'];
  const totals = new Map<string, { total: number; count: number }>();
  for (const key of order) totals.set(key, { total: 0, count: 0 });
  if (Array.isArray(arr)) {
    for (const inv of arr) {
      const due = (inv as { DueDate?: unknown })?.DueDate;
      const amt = Number((inv as { AmountDue?: unknown })?.AmountDue);
      const bucket = String(age_bucket({ value: due })) as keyof typeof tones;
      const entry = totals.get(bucket);
      if (!entry) continue;
      entry.total += Number.isFinite(amt) ? amt : 0;
      entry.count += 1;
    }
  }
  return order.map((key) => ({
    key,
    total: totals.get(key)!.total,
    count: totals.get(key)!.count,
    tone: tones[key],
  }));
};

// ── invoices_in_bucket ───────────────────────────────────────────────
// Return only the invoices whose DueDate places them in a specific
// aging bucket. Used by the Aged Receivables widget to render the
// per-bucket drill-down list.
// Args: { value: Invoice[], bucket: 'Current'|'1-30'|'31-60'|'61-90'|'90+' }
const invoices_in_bucket: ComputedFunction = (args) => {
  const arr = args.value;
  const bucket = String(args.bucket ?? '');
  if (!Array.isArray(arr) || !bucket) return [];
  return arr.filter((inv) => {
    const due = (inv as { DueDate?: unknown })?.DueDate;
    return String(age_bucket({ value: due })) === bucket;
  });
};

// ── age_bucket ───────────────────────────────────────────────────────
// Aged bucket label. "Current" | "1-30" | "31-60" | "61-90" | "90+".
const age_bucket: ComputedFunction = (args) => {
  const n = Number(days_overdue({ value: args.value }));
  if (!Number.isFinite(n) || n <= 0) return 'Current';
  if (n <= 30) return '1-30';
  if (n <= 60) return '31-60';
  if (n <= 90) return '61-90';
  return '90+';
};

// ── age_bucket_tone ──────────────────────────────────────────────────
// Semantic tone for the aged bucket above.
const age_bucket_tone: ComputedFunction = (args) => {
  const bucket = String(age_bucket({ value: args.value }));
  if (bucket === 'Current') return 'success';
  if (bucket === '1-30') return 'info';
  if (bucket === '31-60') return 'warning';
  return 'destructive';
};

// ── analyze_duplicates ───────────────────────────────────────────────
// Cross-checks Xero Contacts, Invoices (both ACCPAY bills and ACCREC
// sales invoices), BankTransactions, and Payments for likely duplicates.
// Each of the 4 raw arrays may still be undefined (its tool call hasn't
// resolved yet) — treated as empty until it arrives, so the result
// converges as each of the 4 chained tool calls lands.
//
// "Same Contact" below means the same CANONICAL contact — Contacts that are
// themselves flagged as duplicates of each other (shared email/tax, or a
// fuzzy name hit) are merged into one cluster first, so a bill/invoice/bank
// line split across two duplicate contact records (e.g. "Acme" vs "Acme Pty
// Ltd", both real records for the same vendor) still matches its counterpart
// under the sibling record.
//
// Match rules, each tagged 'exact' or 'fuzzy' (see matchMode below):
//   Contacts        — exact: same normalized EmailAddress OR TaxNumber (ABN).
//                      fuzzy: similar Name (Levenshtein ratio >=0.82,
//                      bucketed by first name-token).
//   Supplier Bills   — Invoices where Type=="ACCPAY". exact: same Contact +
//                      same non-blank InvoiceNumber (a blank number is never
//                      matched — too common and not a real signal). fuzzy:
//                      same Contact + same Total, whole-group date span <=1
//                      day.
//   Sales Invoices   — Invoices where Type=="ACCREC". list_invoices always
//                      returns LineItems: [] (only the single-invoice
//                      get_invoice call returns real line detail), so no
//                      per-line signature is available. exact: same Contact
//                      + same Total + same calendar day. fuzzy: same
//                      Contact + same Total, within 1 day of an exact-tagged
//                      match (catches a same-batch entry a day either side).
//                      A recurring same-amount invoice spread weeks/months
//                      apart matches neither tier.
//   Spend/Receive    — BankTransactions: same BankAccount + same Contact +
//                      same Total + same Type, whole-group date span <=1 day
//                      to qualify at all (excludes recurring fixed-amount
//                      transactions, whose adjacent gaps can be short even
//                      though the whole series spans months). exact: members
//                      sharing the same calendar day within that group.
//                      fuzzy: the rest of the qualifying group.
//   Payments         — exact only: a Payment whose Invoice has more than
//                      one Payment against it ("paid twice"), or whose
//                      Invoice's total Payments exceed the Invoice's own
//                      Total (overpaid). Counts flagged payment records,
//                      not invoices.
//
// valueAtRisk sums AmountDue across flagged, still-unpaid (Status ==
// "AUTHORISED") Supplier Bills + Sales Invoices only — the only two
// categories with a genuine "unpaid amount" concept.
//
// periodDays (default 90) drops records older than that many days before
// matching runs, using each entity's own recency field (Contacts:
// UpdatedDateUTC; Invoices/BankTransactions/Payments: Date) — a client-side
// window over whatever's already been fetched, not a fresh server query
// (Xero tool-call params can't read a live filter value).
//
// matchMode ('exact' | 'exact_fuzzy' | 'fuzzy', default 'exact_fuzzy')
// selects which tagged tier(s) count toward each category's final total.
//
// statusMode ('open' | 'reviewed' | 'all', default 'open') — there's no
// "mark as reviewed" feature, so 'reviewed' honestly returns zero
// duplicates everywhere; 'open'/'all' both show everything currently
// flagged. Doesn't affect recordsScanned.
//
// detailRows returns one row per flagged record surviving the period/match
// filters — { category, label, detail, severity } — for a click-through
// drill-down table. Severity per row reuses the fixed per-category
// severity already shown on the category badges (Medium/High).
//
// Args: { contacts?: Contact[], invoices?: Invoice[],
//         bankTransactions?: BankTransaction[], payments?: Payment[],
//         periodDays?: number, matchMode?: string, statusMode?: string }
const analyze_duplicates: ComputedFunction = (args) => {
  const periodDays = Number(args.periodDays) > 0 ? Number(args.periodDays) : 90;
  const matchMode = ['exact', 'fuzzy'].includes(String(args.matchMode)) ? String(args.matchMode) : 'exact_fuzzy';
  const statusMode = ['reviewed', 'all'].includes(String(args.statusMode)) ? String(args.statusMode) : 'open';
  const tierAllowed = (tier: 'exact' | 'fuzzy') => matchMode === 'exact_fuzzy' || matchMode === tier;

  const now = Date.now();
  const withinPeriod = (raw: unknown): boolean => {
    const ms = toEpochMs(raw);
    if (ms == null) return true; // no date on the record — don't exclude it
    return (now - ms) / 86_400_000 <= periodDays;
  };

  const rawContacts = Array.isArray(args.contacts) ? (args.contacts as Record<string, unknown>[]) : [];
  const rawInvoices = Array.isArray(args.invoices) ? (args.invoices as Record<string, unknown>[]) : [];
  const rawBankTx = Array.isArray(args.bankTransactions) ? (args.bankTransactions as Record<string, unknown>[]) : [];
  const rawPayments = Array.isArray(args.payments) ? (args.payments as Record<string, unknown>[]) : [];

  // Xero's list endpoints return VOIDED/DELETED historical records alongside
  // active ones (confirmed against real data: a genuinely voided bank
  // transaction and a deleted payment were both being treated as live
  // duplicates of their still-active counterpart). Invoices allow DRAFT/
  // SUBMITTED/AUTHORISED/PAID as legitimately active — only VOIDED/DELETED
  // are excluded. BankTransactions/Payments only have AUTHORISED/DELETED,
  // so only AUTHORISED counts.
  const isActiveInvoice = (inv: Record<string, unknown>) => !['VOIDED', 'DELETED'].includes(String(inv.Status ?? ''));

  const contacts = rawContacts.filter((c) => withinPeriod(c.UpdatedDateUTC));
  const invoices = rawInvoices.filter((inv) => isActiveInvoice(inv) && withinPeriod(inv.Date));
  const bankTx = rawBankTx.filter((tx) => tx.Status === 'AUTHORISED' && withinPeriod(tx.Date));
  const payments = rawPayments.filter((p) => p.Status === 'AUTHORISED' && withinPeriod(p.Date));

  const normEmail = (s: unknown) => String(s ?? '').toLowerCase().trim();
  const normTax = (s: unknown) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const normName = (s: unknown) =>
    String(s ?? '').toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');

  const levenshteinRatio = (a: string, b: string): number => {
    if (a === b) return 1;
    if (!a.length || !b.length) return 0;
    const m = a.length, n = b.length;
    const dp = new Array(n + 1);
    for (let j = 0; j <= n; j++) dp[j] = j;
    for (let i = 1; i <= m; i++) {
      let prev = dp[0];
      dp[0] = i;
      for (let j = 1; j <= n; j++) {
        const tmp = dp[j];
        dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
        prev = tmp;
      }
    }
    return 1 - dp[n] / Math.max(m, n);
  };

  const daysBetween = (a: unknown, b: unknown): number => {
    const ma = toEpochMs(a);
    const mb = toEpochMs(b);
    if (ma == null || mb == null) return Infinity;
    return Math.abs(ma - mb) / 86_400_000;
  };

  type Tier = 'exact' | 'fuzzy';
  const detailRows: { category: string; label: string; detail: string; severity: string }[] = [];

  // ── Contacts ─────────────────────────────────────────────────────
  // Union-Find over contact IDs: any two contacts linked by the SAME match
  // rule used for contactTier below (shared email/tax, or a fuzzy name hit)
  // are merged into one canonical cluster. Bills/Sales Invoices/Bank
  // Transactions use `canonicalContact()` instead of the raw Contact ID when
  // grouping, so an invoice split across two duplicate contact records (e.g.
  // "Acme" and "Acme Pty Ltd" both real records for the same vendor) still
  // gets matched against its counterpart under the sibling record — the
  // single biggest source of missed cross-category duplicates confirmed
  // against real data (a supplier's bills split across two near-duplicate
  // contact records were otherwise invisible to each other).
  const contactParent = new Map<string, string>();
  const findContactRoot = (id: string): string => {
    if (!contactParent.has(id)) contactParent.set(id, id);
    let root = id;
    while (contactParent.get(root) !== root) root = contactParent.get(root)!;
    let cur = id;
    while (contactParent.get(cur) !== root) {
      const next = contactParent.get(cur)!;
      contactParent.set(cur, root);
      cur = next;
    }
    return root;
  };
  const unionContacts = (a: string, b: string) => {
    const ra = findContactRoot(a);
    const rb = findContactRoot(b);
    if (ra !== rb) contactParent.set(ra, rb);
  };
  const canonicalContact = (id: string): string => (contactParent.has(id) ? findContactRoot(id) : id);

  const contactTier = new Map<string, Tier>();
  const contactById = new Map<string, Record<string, unknown>>();
  {
    type CRec = { id: string; name: string; email: string; tax: string };
    const recs: CRec[] = contacts.map((c, i) => {
      const id = String(c.ContactID ?? i);
      contactById.set(id, c);
      return {
        id,
        name: normName(c.Name ?? `${c.FirstName ?? ''} ${c.LastName ?? ''}`),
        email: normEmail(c.EmailAddress),
        tax: normTax(c.TaxNumber),
      };
    });
    const groupBy = (key: (r: CRec) => string, minLen = 1) => {
      const map = new Map<string, string[]>();
      for (const r of recs) {
        const k = key(r);
        if (k.length < minLen) continue;
        (map.get(k) ?? map.set(k, []).get(k)!).push(r.id);
      }
      return map;
    };
    for (const [, ids] of groupBy((r) => r.email)) {
      if (ids.length > 1) {
        ids.forEach((id) => contactTier.set(id, 'exact'));
        for (let i = 1; i < ids.length; i++) unionContacts(ids[0], ids[i]);
      }
    }
    for (const [, ids] of groupBy((r) => r.tax)) {
      if (ids.length > 1) {
        ids.forEach((id) => contactTier.set(id, 'exact'));
        for (let i = 1; i < ids.length; i++) unionContacts(ids[0], ids[i]);
      }
    }

    // Bucket EVERY named contact by first name-token — including ones
    // already tagged 'exact' — so an already-matched contact can still
    // serve as the anchor that catches a third, fuzzy-only variant (e.g.
    // two contacts share an exact email; a third, differently-spelled
    // variant with a DIFFERENT email is only findable by comparing it
    // against one of the first two). Only contacts not yet tagged get a
    // NEW tier assigned here — an already-'exact' contact's tag is never
    // downgraded, it just participates as a comparison target.
    const byToken = new Map<string, CRec[]>();
    for (const r of recs) {
      if (!r.name) continue;
      const token = r.name.split(' ')[0];
      (byToken.get(token) ?? byToken.set(token, []).get(token)!).push(r);
    }
    for (const [, bucket] of byToken) {
      for (let i = 0; i < bucket.length; i++) {
        for (let j = i + 1; j < bucket.length; j++) {
          if (bucket[i].name === bucket[j].name) continue;
          if (levenshteinRatio(bucket[i].name, bucket[j].name) >= 0.82) {
            if (!contactTier.has(bucket[i].id)) contactTier.set(bucket[i].id, 'fuzzy');
            if (!contactTier.has(bucket[j].id)) contactTier.set(bucket[j].id, 'fuzzy');
            unionContacts(bucket[i].id, bucket[j].id);
          }
        }
      }
    }
  }
  const contactDup = new Set([...contactTier.entries()].filter(([, t]) => tierAllowed(t)).map(([id]) => id));
  for (const id of contactDup) {
    const c = contactById.get(id);
    detailRows.push({
      category: 'Contacts',
      label: String(c?.Name ?? 'Unknown'),
      detail: c?.EmailAddress ? String(c.EmailAddress) : 'Similar name',
      severity: 'Medium',
    });
  }

  // ── Invoices: split into Supplier Bills (ACCPAY) and Sales Invoices (ACCREC) ──
  const bills = invoices.filter((inv) => inv.Type === 'ACCPAY');
  const salesInv = invoices.filter((inv) => inv.Type === 'ACCREC');
  const invoiceById = new Map<string, Record<string, unknown>>();
  for (const inv of invoices) invoiceById.set(String(inv.InvoiceID ?? ''), inv);

  const billTier = new Map<string, Tier>();
  {
    type BillRec = { id: string; contactId: string; total: unknown; num: string; date: unknown };
    const recs: BillRec[] = bills.map((inv) => ({
      id: String(inv.InvoiceID ?? ''),
      contactId: String((inv.Contact as Record<string, unknown> | undefined)?.ContactID ?? ''),
      total: inv.Total,
      // A blank InvoiceNumber is common (many bills are entered with no
      // reference at all) — matching on it anyway collapsed every
      // no-reference bill from the same supplier into one false "exact"
      // group regardless of amount or date (confirmed against real data: two
      // entirely unrelated bills, different totals months apart, were both
      // blank-numbered and got flagged purely for that). Only a genuinely
      // shared, non-blank number counts as an exact match.
      num: String(inv.InvoiceNumber ?? '').trim(),
      date: inv.Date,
    }));

    // Pass 1 — same RAW contact (no cross-contact inference yet).
    const byContactNum = new Map<string, BillRec[]>();
    const byContactTotal = new Map<string, BillRec[]>();
    for (const r of recs) {
      if (r.num) {
        const numKey = `${r.contactId}|${r.num}`;
        (byContactNum.get(numKey) ?? byContactNum.set(numKey, []).get(numKey)!).push(r);
      }
      const totalKey = `${r.contactId}|${r.total ?? ''}`;
      (byContactTotal.get(totalKey) ?? byContactTotal.set(totalKey, []).get(totalKey)!).push(r);
    }
    for (const [, group] of byContactNum) if (group.length > 1) group.forEach((r) => billTier.set(r.id, 'exact'));
    // Same contact + same Total + the SAME calendar day => fuzzy (this is
    // the 'exact' tier's InvoiceNumber signal missing, so it never counts
    // above fuzzy). A recurring fixed-amount bill (e.g. a weekly
    // cleaning-service invoice, confirmed in real data landing exactly 7
    // days apart every time) shares contact+total with many OTHER
    // legitimate instances of itself — requiring the SAME day, not just
    // "within N days", is what keeps that recurring series out (confirmed:
    // every genuine fuzzy match in real data was same-day; a same-contact
    // match landing even a day off the same total was confirmed, via the
    // matching Sales Invoices case, to be a coincidence, not a duplicate).
    for (const [, group] of byContactTotal) {
      if (group.length < 2) continue;
      const byDay = new Map<string, BillRec[]>();
      for (const r of group) {
        const ms = toEpochMs(r.date);
        if (ms == null) continue;
        const dayKey = String(Math.floor(ms / 86_400_000));
        (byDay.get(dayKey) ?? byDay.set(dayKey, []).get(dayKey)!).push(r);
      }
      for (const [, ids] of byDay) {
        if (ids.length > 1) ids.forEach((r) => { if (!billTier.has(r.id)) billTier.set(r.id, 'fuzzy'); });
      }
    }

    // Pass 2 — cross the contact boundary using canonicalContact, but ONLY
    // for bills not already tagged above, and NEVER above 'fuzzy': a match
    // that only exists because two Contact records are themselves flagged
    // as duplicates is a two-hop inference, not a same-record fact, even
    // when the invoice number or total+date line up exactly (confirmed
    // against real data: a supplier's bill entered under its "Pty Ltd"
    // duplicate contact record, same invoice number/total/date as the
    // canonical exact pair — a real match, but one hop weaker than the
    // pair itself).
    const byCanonNum = new Map<string, BillRec[]>();
    const byCanonTotal = new Map<string, BillRec[]>();
    for (const r of recs) {
      const canon = canonicalContact(r.contactId);
      if (r.num) {
        const numKey = `${canon}|${r.num}`;
        (byCanonNum.get(numKey) ?? byCanonNum.set(numKey, []).get(numKey)!).push(r);
      }
      const totalKey = `${canon}|${r.total ?? ''}`;
      (byCanonTotal.get(totalKey) ?? byCanonTotal.set(totalKey, []).get(totalKey)!).push(r);
    }
    for (const [, group] of byCanonNum) {
      if (!group.some((r) => billTier.get(r.id) === 'exact')) continue;
      group.forEach((r) => { if (!billTier.has(r.id)) billTier.set(r.id, 'fuzzy'); });
    }
    for (const [, group] of byCanonTotal) {
      const exactRecs = group.filter((r) => billTier.get(r.id) === 'exact');
      if (exactRecs.length === 0) continue;
      for (const r of group) {
        if (billTier.has(r.id)) continue;
        const rDay = toEpochMs(r.date);
        if (rDay == null) continue;
        const rDayKey = Math.floor(rDay / 86_400_000);
        const crossContactSameDay = exactRecs.some((e) => {
          if (e.contactId === r.contactId) return false;
          const eDay = toEpochMs(e.date);
          return eDay != null && Math.floor(eDay / 86_400_000) === rDayKey;
        });
        if (crossContactSameDay) billTier.set(r.id, 'fuzzy');
      }
    }
  }
  const billDup = new Set([...billTier.entries()].filter(([, t]) => tierAllowed(t)).map(([id]) => id));
  for (const id of billDup) {
    const inv = invoiceById.get(id);
    const contact = inv?.Contact as Record<string, unknown> | undefined;
    detailRows.push({
      category: 'Supplier Bills',
      label: `${inv?.InvoiceNumber || id} — ${contact?.Name ?? 'Unknown'}`,
      detail: `$${Number(inv?.Total ?? 0).toFixed(2)}`,
      severity: 'High',
    });
  }

  const salesInvTier = new Map<string, Tier>();
  {
    // Xero's list_invoices endpoint always returns LineItems: [] (confirmed
    // against real data — only the single-invoice get_invoice call returns
    // real line detail), so a per-line signature can't discriminate two
    // invoices here; matching instead falls back to same contact + same
    // Total. Used bare, that over-matches badly: a recurring fixed-amount
    // invoice (e.g. a monthly retainer) shares contact+total with many
    // OTHER legitimate instances of itself. Same contact + same Total + the
    // SAME calendar day is an exact match (a genuine same-day double-entry).
    // Unlike Bank Transactions, an adjacent-day (not same-day) match on the
    // SAME contact is deliberately NOT tagged at all here — confirmed
    // against real data (and the user's own manual Xero-UI cross-check) that
    // an invoice landing a day after a same-contact exact pair, sharing only
    // the Total, is a coincidence (a genuinely separate invoice), not a
    // duplicate — with no LineItems to corroborate it, date-window fuzzing
    // on top of an already-uncertain signal produces false positives.
    type SalesRec = { id: string; contactId: string; total: unknown; date: unknown };
    const recs: SalesRec[] = salesInv.map((inv) => ({
      id: String(inv.InvoiceID ?? ''),
      contactId: String((inv.Contact as Record<string, unknown> | undefined)?.ContactID ?? ''),
      total: inv.Total,
      date: inv.Date,
    }));
    const dayKeyOf = (date: unknown): string | null => {
      const ms = toEpochMs(date);
      return ms == null ? null : String(Math.floor(ms / 86_400_000));
    };

    // Pass 1 — same RAW contact, same calendar day => exact. Nothing else.
    const byContactTotal = new Map<string, SalesRec[]>();
    for (const r of recs) {
      const key = `${r.contactId}|${r.total ?? ''}`;
      (byContactTotal.get(key) ?? byContactTotal.set(key, []).get(key)!).push(r);
    }
    for (const [, group] of byContactTotal) {
      if (group.length < 2) continue;
      const byDay = new Map<string, SalesRec[]>();
      for (const r of group) {
        const dayKey = dayKeyOf(r.date);
        if (dayKey == null) continue;
        (byDay.get(dayKey) ?? byDay.set(dayKey, []).get(dayKey)!).push(r);
      }
      for (const [, ids] of byDay) if (ids.length > 1) ids.forEach((r) => salesInvTier.set(r.id, 'exact'));
    }

    // Pass 2 — cross the contact boundary via canonicalContact, but ONLY for
    // an untagged invoice sharing the EXACT SAME calendar day (not "within N
    // days") as an exact-tagged record under a DIFFERENT raw Contact, and
    // NEVER tagged above 'fuzzy': a match that only exists because the two
    // Contact records are themselves flagged as duplicates is one hop
    // weaker than a same-record match (confirmed against real data — an
    // invoice entered under a supplier's "Pty Ltd" duplicate contact record,
    // same total/date as the canonical exact pair).
    const byCanonTotal = new Map<string, SalesRec[]>();
    for (const r of recs) {
      const key = `${canonicalContact(r.contactId)}|${r.total ?? ''}`;
      (byCanonTotal.get(key) ?? byCanonTotal.set(key, []).get(key)!).push(r);
    }
    for (const [, group] of byCanonTotal) {
      const exactRecs = group.filter((r) => salesInvTier.get(r.id) === 'exact');
      if (exactRecs.length === 0) continue;
      for (const r of group) {
        if (salesInvTier.has(r.id)) continue;
        const rDay = dayKeyOf(r.date);
        if (rDay != null && exactRecs.some((e) => e.contactId !== r.contactId && dayKeyOf(e.date) === rDay)) {
          salesInvTier.set(r.id, 'fuzzy');
        }
      }
    }
  }
  const salesInvDup = new Set([...salesInvTier.entries()].filter(([, t]) => tierAllowed(t)).map(([id]) => id));
  for (const id of salesInvDup) {
    const inv = invoiceById.get(id);
    const contact = inv?.Contact as Record<string, unknown> | undefined;
    detailRows.push({
      category: 'Sales Invoices',
      label: `${inv?.InvoiceNumber || id} — ${contact?.Name ?? 'Unknown'}`,
      detail: `$${Number(inv?.Total ?? 0).toFixed(2)}`,
      severity: 'Medium',
    });
  }

  // ── Bank transactions ────────────────────────────────────────────
  // Matches on the WHOLE GROUP's date span (max - min <= 1 day), not
  // same-day-only pairwise matching. A recurring fixed-amount transaction
  // (a weekly/fortnightly fee, a regular supplier payment) shares
  // account+contact+total with many OTHER instances of itself, and its
  // ADJACENT gaps can legitimately be as short as 1-2 days even though the
  // whole series spans months (confirmed against real data: a recurring
  // fee's own adjacent-day gaps were mostly 1-2 days across a 16-transaction,
  // 25-day-spanning series) — so pairwise/adjacent-only day-window matching
  // still chains a long recurring series together. A genuine duplicate
  // cluster (the same line double- or triple-keyed) is instead tightly
  // bunched as a WHOLE: every member falls within about a day of every
  // other member, not just of its nearest neighbour. Confirmed against real
  // data: a genuine 3-way duplicate (2 same-day + 1 exactly one day later)
  // has a whole-group span of 1 day; every recurring series in this dataset
  // spans 25-70+ days even though individual gaps are short.
  // Also excludes transactions with no Contact set at all — Xero commonly
  // leaves bank lines uncoded, and treating "blank" as a match value would
  // wrongly group unrelated uncoded transactions that just share an amount.
  const bankTxTier = new Map<string, Tier>();
  const bankTxById = new Map<string, Record<string, unknown>>();
  {
    type TxRec = { id: string; contactId: string; accountId: string; total: unknown; type: string; date: unknown };
    const recs: TxRec[] = [];
    for (const tx of bankTx) {
      const id = String(tx.BankTransactionID ?? '');
      bankTxById.set(id, tx);
      const contactId = String((tx.Contact as Record<string, unknown> | undefined)?.ContactID ?? '');
      if (!contactId) continue;
      const accountId = String((tx.BankAccount as Record<string, unknown> | undefined)?.AccountID ?? '');
      recs.push({ id, contactId, accountId, total: tx.Total, type: String(tx.Type ?? ''), date: tx.Date });
    }

    // Within a tightly-bunched (whole-group span <=1 day) candidate group,
    // members sharing the SAME calendar day are a genuine exact duplicate; a
    // member landing up to a day off from an exact-tagged pair is the
    // softer, still-likely case. Every member of a qualifying group is
    // within 1 day of every other member by construction, so anyone not
    // absorbed into a same-day exact pair still counts as fuzzy.
    const tierSpanGroup = (group: TxRec[]) => {
      if (group.length < 2) return;
      const times = group.map((r) => toEpochMs(r.date)).filter((t): t is number => t != null);
      if (times.length < 2) return;
      const spanDays = (Math.max(...times) - Math.min(...times)) / 86_400_000;
      if (spanDays > 1) return;
      const byDay = new Map<string, TxRec[]>();
      for (const r of group) {
        const ms = toEpochMs(r.date);
        if (ms == null) continue;
        const dayKey = String(Math.floor(ms / 86_400_000));
        (byDay.get(dayKey) ?? byDay.set(dayKey, []).get(dayKey)!).push(r);
      }
      for (const [, ids] of byDay) if (ids.length > 1) ids.forEach((r) => bankTxTier.set(r.id, 'exact'));
      for (const r of group) if (!bankTxTier.has(r.id)) bankTxTier.set(r.id, 'fuzzy');
    };

    // Pass 1 — same RAW contact.
    // Include Type — a RECEIVE and a SPEND that happen to share the same
    // amount are opposite-direction transactions, not duplicates of each
    // other (confirmed against real data: a $39.50 RECEIVE and a $39.50
    // SPEND were otherwise being matched purely on coincidental amount).
    const byKey = new Map<string, TxRec[]>();
    for (const r of recs) {
      const key = `${r.accountId}|${r.contactId}|${r.total ?? ''}|${r.type}`;
      (byKey.get(key) ?? byKey.set(key, []).get(key)!).push(r);
    }
    for (const [, group] of byKey) tierSpanGroup(group);

    // Pass 2 — cross the contact boundary via canonicalContact, but ONLY for
    // transactions not already tagged, and NEVER above 'fuzzy' (same
    // reasoning as the Bills/Sales Invoices pass 2 above).
    const byCanonKey = new Map<string, TxRec[]>();
    for (const r of recs) {
      const key = `${r.accountId}|${canonicalContact(r.contactId)}|${r.total ?? ''}|${r.type}`;
      (byCanonKey.get(key) ?? byCanonKey.set(key, []).get(key)!).push(r);
    }
    for (const [, group] of byCanonKey) {
      const exactRecs = group.filter((r) => bankTxTier.get(r.id) === 'exact');
      if (exactRecs.length === 0) continue;
      for (const r of group) {
        if (bankTxTier.has(r.id)) continue;
        if (exactRecs.some((e) => daysBetween(r.date, e.date) <= 1)) bankTxTier.set(r.id, 'fuzzy');
      }
    }
  }
  const bankTxDup = new Set([...bankTxTier.entries()].filter(([, t]) => tierAllowed(t)).map(([id]) => id));
  for (const id of bankTxDup) {
    const tx = bankTxById.get(id);
    const account = tx?.BankAccount as Record<string, unknown> | undefined;
    detailRows.push({
      category: 'Spend / Receive Money',
      label: `${account?.Name ?? 'Bank'} — $${Number(tx?.Total ?? 0).toFixed(2)}`,
      detail: String(tx?.Type ?? ''),
      severity: 'Medium',
    });
  }

  // ── Payments ─────────────────────────────────────────────────────
  const paymentTier = new Map<string, Tier>();
  const paymentById = new Map<string, Record<string, unknown>>();
  {
    const invoiceTotalById = new Map<string, number>();
    for (const inv of rawInvoices) {
      if (!isActiveInvoice(inv)) continue;
      invoiceTotalById.set(String(inv.InvoiceID ?? ''), Number(inv.Total) || 0);
    }
    const byInvoice = new Map<string, { id: string; amount: number }[]>();
    for (const p of payments) {
      const id = String(p.PaymentID ?? '');
      paymentById.set(id, p);
      const invoiceId = String((p.Invoice as Record<string, unknown> | undefined)?.InvoiceID ?? '');
      if (!invoiceId) continue; // no shared invoice to group unrelated payments by
      const amount = Number(p.Amount) || 0;
      (byInvoice.get(invoiceId) ?? byInvoice.set(invoiceId, []).get(invoiceId)!).push({ id, amount });
    }
    // Flag only genuine overpayment (sum of payments > invoice Total) — NOT
    // "more than one payment against this invoice" alone, which also
    // matches entirely legitimate split/installment payments (e.g. two
    // differing-amount instalments that together equal the invoice Total).
    // Confirmed against real data: every actual duplicate case here is two
    // IDENTICAL-amount payments that together exceed the Total; the two
    // false positives this replaces were differing-amount instalments that
    // summed to exactly the Total.
    for (const [invoiceId, group] of byInvoice) {
      const total = invoiceTotalById.get(invoiceId) ?? 0;
      const sum = group.reduce((s, p) => s + p.amount, 0);
      if (total > 0 && sum > total) {
        group.forEach((p) => paymentTier.set(p.id, 'exact'));
      }
    }
  }
  const paymentDup = new Set([...paymentTier.entries()].filter(([, t]) => tierAllowed(t)).map(([id]) => id));
  for (const id of paymentDup) {
    const p = paymentById.get(id);
    detailRows.push({
      category: 'Payments',
      label: `${p?.Reference || 'Payment'} — $${Number(p?.Amount ?? 0).toFixed(2)}`,
      detail: String(p?.PaymentType ?? ''),
      severity: 'High',
    });
  }

  const valueAtRisk = [...bills, ...salesInv]
    .filter((inv) => billDup.has(String(inv.InvoiceID ?? '')) || salesInvDup.has(String(inv.InvoiceID ?? '')))
    .filter((inv) => inv.Status === 'AUTHORISED')
    .reduce((sum, inv) => sum + (Number(inv.AmountDue) || 0), 0);

  // Exact vs likely split — a record's own tier is fixed, but only counted
  // here if matchMode currently allows it (mirrors how contactDup/billDup/etc.
  // are themselves built), so e.g. selecting "Exact only" correctly zeroes
  // out every category's likelyCount rather than showing a stale split.
  const tierCounts = (tier: Map<string, Tier>) => {
    let exact = 0, likely = 0;
    for (const t of tier.values()) {
      if (t === 'exact' && tierAllowed('exact')) exact++;
      if (t === 'fuzzy' && tierAllowed('fuzzy')) likely++;
    }
    return { exact, likely };
  };
  const contactTierCounts = tierCounts(contactTier);
  const billTierCounts = tierCounts(billTier);
  const salesInvTierCounts = tierCounts(salesInvTier);
  const bankTxTierCounts = tierCounts(bankTxTier);
  const paymentTierCounts = tierCounts(paymentTier);
  const exactCount =
    contactTierCounts.exact + billTierCounts.exact + salesInvTierCounts.exact + bankTxTierCounts.exact + paymentTierCounts.exact;
  const likelyCount =
    contactTierCounts.likely + billTierCounts.likely + salesInvTierCounts.likely + bankTxTierCounts.likely + paymentTierCounts.likely;

  const totalDuplicates = contactDup.size + billDup.size + salesInvDup.size + bankTxDup.size + paymentDup.size;
  const recordsScanned = rawContacts.length + rawInvoices.length + rawBankTx.length + rawPayments.length;
  // Only stamped fresh when this recompute was triggered by an actual Xero
  // fetch landing (mount, chained cascade, or a Rescan click re-firing the
  // chain) — NOT by a filter dropdown change, which just re-filters data
  // already in hand without querying Xero again. Filter-only callers pass
  // the current `/ui/dup/lastScannedAt` through as `existingScannedAt` so
  // "Last scanned" doesn't misleadingly jump to "just now" on a plain
  // client-side re-filter.
  const lastScannedAt =
    typeof args.existingScannedAt === 'string' && args.existingScannedAt
      ? args.existingScannedAt
      : new Date().toISOString();

  if (statusMode === 'reviewed') {
    return {
      contacts: { count: 0, exactCount: 0, likelyCount: 0 },
      supplierBills: { count: 0, exactCount: 0, likelyCount: 0 },
      salesInvoices: { count: 0, exactCount: 0, likelyCount: 0 },
      bankTx: { count: 0, exactCount: 0, likelyCount: 0 },
      payments: { count: 0, exactCount: 0, likelyCount: 0 },
      totalDuplicates: 0,
      exactCount: 0,
      likelyCount: 0,
      valueAtRisk: 0,
      recordsScanned,
      detailRows: [],
      lastScannedAt,
    };
  }

  return {
    contacts: { count: contactDup.size, exactCount: contactTierCounts.exact, likelyCount: contactTierCounts.likely },
    supplierBills: { count: billDup.size, exactCount: billTierCounts.exact, likelyCount: billTierCounts.likely },
    salesInvoices: { count: salesInvDup.size, exactCount: salesInvTierCounts.exact, likelyCount: salesInvTierCounts.likely },
    bankTx: { count: bankTxDup.size, exactCount: bankTxTierCounts.exact, likelyCount: bankTxTierCounts.likely },
    payments: { count: paymentDup.size, exactCount: paymentTierCounts.exact, likelyCount: paymentTierCounts.likely },
    totalDuplicates,
    exactCount,
    likelyCount,
    valueAtRisk,
    recordsScanned,
    detailRows,
    lastScannedAt,
  };
};

const elements: PluginElementsModule = {
  slug: 'xero-accounting',
  functions: {
    format_date,
    status_tone,
    status_label,
    age_bucket,
    age_bucket_tone,
    age_buckets,
    invoices_in_bucket,
    bank_tx_icon,
    bank_tx_tone,
    bank_tx_label,
    reconciliation_breakdown,
    remittance_rows,
    remittance_breakdown,
    reimbursement_draft_rows,
    days_overdue,
    overdue_label,
    overdue_only,
    overdue_tone,
    po_status_tone,
    quote_status_tone,
    this_month_range,
    prev_month_range,
    next_n_days,
    flatten_report_rows,
    report_find_row,
    analyze_duplicates,
  },
};

export default elements;
