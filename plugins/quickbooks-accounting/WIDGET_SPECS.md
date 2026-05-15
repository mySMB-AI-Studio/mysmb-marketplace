# QuickBooks Accounting — Widget Specs

Five widgets prioritized after researching what accountants and CAS practitioners actually request from QBO. Each one (a) is daily-use, (b) closes a known gap in QBO's stock dashboard, (c) maps cleanly onto the MCP tools we already expose, and (d) is actionable, not just read-only.

Build order is suggested 1 → 5 below: each later widget shares computed helpers with an earlier one, so we can amortize widget-element work.

---

## Shared conventions

### Tool & response shapes

QBO tool names are **singular** (`list_invoice`, not `list_invoices`). The query response from any `list_*` is shaped:

```
{
  "QueryResponse": {
    "Invoice": [ ... ],          // entity name capitalized
    "startPosition": 1,
    "maxResults": 100,
    "totalCount": 247
  },
  "time": "2026-05-15T18:34:00Z"
}
```

So `$state` paths look like `/quickbooks-accounting/list_invoice/QueryResponse/Invoice`.

`get_<entity>` returns `{ <Entity>: {...}, time: "..." }` — single object under the capitalized entity key.

Report tools (`get_report_*`) return Intuit's report DTO:

```
{
  "Header": { "Time": "...", "ReportName": "...", "StartPeriod": "...", "EndPeriod": "...", "Currency": "USD" },
  "Columns": { "Column": [ {ColTitle, ColType, MetaData}, ... ] },
  "Rows":    { "Row": [ {Header, Rows, Summary, type, group}, ... ] }
}
```

Reports are recursive — `Rows.Row[i].Rows.Row[j]...`. Every widget that reads reports needs a `quickbooks-accounting_flatten_report_rows` helper (analogous to Xero's). Build once, reuse across widgets 1, 2, 4.

### Currency

QBO entities use `CurrencyRef.value` (e.g. `"USD"`); reports use `Header.Currency`. Always pass the currency to `format_currency` — don't assume USD.

### Identity & references

- Customers: `CustomerRef.value` (Id) + `CustomerRef.name` (display)
- Vendors: `VendorRef.value` / `VendorRef.name`
- Bank accounts: `AccountRef.value` / `AccountRef.name`
- Invoice number: `DocNumber`
- Sync token: `SyncToken` — required on every update/delete

### Update semantics

When a widget action mutates an entity, always do `get_<entity>` first to capture the current `SyncToken`, then call the update with `sparse: true`. Never assume the cached row is fresh enough.

### Standard widget skeleton

Every widget follows the Xero pattern:

```
Card
├── Header (title icon + title stack with eyebrow / count)
├── Stats / KPI row (visible when not loading)
├── Divider
├── Body
│   ├── Skeleton stack (visible when /_loading/<mcp>.<tool>)
│   ├── Empty state (visible when not loading AND no rows)
│   └── Repeating list / table (visible when not loading)
└── Overlay (visible when /ui/<widgetSlug>/selectedId)
    └── Detail card (header + close + spinner-while-stale + body)
```

Loading state uses `$state: "/_loading/quickbooks-accounting.<tool>"`. Errors land at `/_errors/quickbooks-accounting.<tool>`.

---

## Widget 1 — AR Aging Cockpit

**Slug:** `qbo-ar-aging-cockpit`
**Title:** "AR Aging Cockpit"
**Category:** `finance`
**Sizing:** preferred `5×4`, min `4×3`, max `12×10`
**Status:** `published` once built
**Connectors used:** `quickbooks-accounting`

### Why this widget

AR aging is the single most-viewed report in any accounting firm. QBO buries it three clicks deep under Reports, and the dashboard version doesn't let you act on a row. Every standalone AR tool sells itself by surfacing aging + per-row email reminders as its primary feature — this widget delivers both inline.

### Headline metric

**DSO** (Days Sales Outstanding) — rendered as a `Stat` in the header eyebrow. Formula:

```
DSO = (Total AR balance / Total credit sales over last 90 days) × 90
```

Total AR comes from the aging report; total 90-day sales comes from `get_report_profit_and_loss` with `date_macro: "Last 90 Days"` → "Total Income" row. Cache the prior month's DSO in `/ui/qbo-ar-aging/dsoPrior` (computed on widget load via a second report call) so we can render a delta chip.

### Data sources

| Tool | Params | Why |
|---|---|---|
| `get_report_aged_receivables` | `report_date: "today"`, `aging_method: "Report_Date"`, `aging_period: 30`, `num_periods: 4` | Bucket totals (Current / 1-30 / 31-60 / 61-90 / 90+) |
| `list_invoice` | `where: "Balance > '0'"`, `orderBy: "DueDate ASC"`, `maxResults: 50` | Per-invoice ranked list with `Balance`, `DueDate`, `CustomerRef.name`, `DocNumber`, `CurrencyRef.value`, `EmailStatus` |
| `get_report_profit_and_loss` | `date_macro: "Last 90 Days"` | For DSO denominator |
| `send_invoice` (on row click) | `id`, optional `sendTo` | One-click reminder |
| `get_invoice` (on detail open) | `id` | Latest SyncToken + line items |
| `pdf_invoice` (detail "PDF" action) | `id` | Base64 download |

### Layout

```
┌─ Header ──────────────────────────────────────────────┐
│ ⏰ AR Aging Cockpit                  DSO 42d ↓ −3d   │
│    {totalCount} open · {sumOpen} due                  │
├─ Stats (Grid cols=5, soft tone-coded) ───────────────┤
│ Current | 1-30 | 31-60 | 61-90 | 90+                  │
│ $12,400 | $8,100 | $4,250 | $2,890 | $7,610           │
├─ Divider ─────────────────────────────────────────────┤
│ ▸ Filter pills: All · Overdue · 60+ · 90+             │
│                                                       │
│ ● ACME Corp                       45 days late        │
│   INV-1021                              $4,250.00 [📧]│
│ ● Beta LLC                        12 days late        │
│   INV-1034                              $1,890.00 [📧]│
│   ...                                                 │
└───────────────────────────────────────────────────────┘
```

### Row rendering

Each row is a clickable `Row` (opens overlay with full invoice detail):

- **severity Dot** — tone from `qbo-accounting_overdue_tone(dueDate)` (success ≤ 0 days, info 1-30, warning 31-60, destructive 60+)
- **identity Stack** — top: `CustomerRef.name` (medium, truncate); bottom: `DocNumber` Caption
- **overdueBadge** — text from `qbo-accounting_overdue_label(dueDate)` ("Due in 3d", "12 days late"); same tone as severity
- **amount Text** — `format_currency(Balance, CurrencyRef.value)`, semibold
- **actions Row** — Mail IconButton (calls `send_invoice`), with `_reminderSent` / `_reminderError` per-row badge state mirroring the Xero pattern

### Filter pills

`/ui/qbo-ar-aging/filter` ∈ {`all`, `overdue`, `60+`, `90+`}. The repeat's `where` clause is derived via watch:

```
watch /ui/qbo-ar-aging/filter →
  re-call list_invoice with appropriate where clause:
    all       → "Balance > '0'"
    overdue   → "Balance > '0' AND DueDate < '<today>'"
    60+       → "Balance > '0' AND DueDate < '<today-60>'"
    90+       → "Balance > '0' AND DueDate < '<today-90>'"
```

Today's date is materialized at watch-fire time by a helper `qbo-accounting_today_minus_days(days)` returning `YYYY-MM-DD`.

### Detail overlay

Header: `Invoice ${DocNumber}` + close. Body KeyValue rows:

- Customer — `CustomerRef.name`
- Due — `qbo-accounting_format_date(DueDate, "medium")`
- Amount due — `Balance` (destructive tone)
- Total — `TotalAmt`
- Email status — `EmailStatus` (NotSet / NeedToSend / EmailSent)
- Memo — `CustomerMemo.value`

Actions row: `Send reminder` (calls `send_invoice` with current `selectedId`), `PDF` (calls `pdf_invoice`, then `download_base64`).

### Computed helpers needed

```
qbo-accounting_overdue_tone(dueDate)         → 'success'|'info'|'warning'|'destructive'
qbo-accounting_overdue_label(dueDate)        → "12 days late" | "Due in 3d" | "Due today"
qbo-accounting_format_date(date, format)     → localized string
qbo-accounting_today_minus_days(days)        → "YYYY-MM-DD"
qbo-accounting_dso(arBalance, sales90)       → number
qbo-accounting_flatten_report_rows(report)   → [{title, depth, c0, c1, c2, c3, c4}]
qbo-accounting_report_find_row(rows, title, cell) → number | ""
```

The report-flatten helper is shared with widgets 2 and 4.

### Edge cases

- Empty list → "Nothing outstanding — you're caught up." with Trophy icon
- DSO denominator (sales90) is 0 → render "—" instead of dividing by zero
- Currency mismatch across rows → show each row in its own currency; bucket totals only sum same-currency invoices; if multi-currency, render a small "Mixed currencies" caption under the totals

---

## Widget 2 — Cash Position & 13-Week Runway

**Slug:** `qbo-cash-runway`
**Title:** "Cash & 13-Week Runway"
**Category:** `finance`
**Sizing:** preferred `6×4`, min `5×3`, max `12×8`

### Why this widget

CFO-advisory practitioners universally name the 13-week cash flow as **the** most valuable client deliverable — "the single most valuable financial tool for small business owners." QBO ships no real forecast; existing add-ons charge $200+/mo for it. A useful approximation needs only: current cash, committed inflows (open AR by due date), and committed outflows (open AP by due date). That's all derivable from QBO directly.

This is an approximation, not a full direct-method forecast (no recurring payroll patterns, no operational expense projection). We label it that way and let the accountant treat it as a starting point.

### Headline metric

**Weeks of runway** — large `Stat` in the header. Formula:

```
If average weekly net cash flow over the forecast horizon is negative:
  runway = current_cash / |avg_weekly_net|
Else:
  runway = "∞" (i.e. cash growing)
```

### Data sources

| Tool | Params | Why |
|---|---|---|
| `list_account` | `where: "Active = true AND (AccountType = 'Bank' OR AccountType = 'Credit Card')"` | Current balances per bank/CC account |
| `list_invoice` | `where: "Balance > '0'"`, `orderBy: "DueDate ASC"`, `maxResults: 1000` | Projected inflows by due date |
| `list_bill` | `where: "Balance > '0'"`, `orderBy: "DueDate ASC"`, `maxResults: 1000` | Projected outflows by due date |

We deliberately don't fetch payroll or recurring expenses — that scope creep would require either (a) a manual override panel or (b) parsing the journal. v1 is "committed only."

### KPI strip (Grid cols=3)

1. **Current Cash** — sum of `CurrentBalance` across bank accounts (excluding credit cards from cash; show CC sum as a secondary caption); tone: success if > 0, destructive if < 0
2. **Committed Inflows (13w)** — sum of `Balance` on invoices due in next 91 days; success tone
3. **Committed Outflows (13w)** — sum of `Balance` on bills due in next 91 days; destructive tone

### Body — weekly forecast table

13 columns (`Wk 1` … `Wk 13`) starting from the current ISO week. Each cell shows projected ending cash for that week, color-coded:

- `cash > 0` → success tone
- `0 ≥ cash > -threshold` → warning (threshold = 5% of starting cash, or $5k floor)
- `cash ≤ -threshold` → destructive

A `LineChart` element renders the 13-week ending-cash curve above the table. The earliest week to go negative is annotated.

### Computed weekly projection

A widget-element function bucketing AR + AP by week, producing the rolled-up week-end balances. Pseudocode:

```ts
qbo-accounting_weekly_cash_projection({ openingCash, invoices, bills, weeks = 13 }) {
  const today = new Date(); // local week start
  const buckets = Array.from({ length: weeks }, (_, i) => ({
    weekIndex: i + 1,
    weekStart: addDays(today, i * 7),
    inflow: 0,
    outflow: 0,
    endingCash: 0,
  }));
  for (const inv of invoices) {
    const w = weekOf(inv.DueDate, today);
    if (w >= 0 && w < weeks) buckets[w].inflow += +inv.Balance;
  }
  for (const bill of bills) {
    const w = weekOf(bill.DueDate, today);
    if (w >= 0 && w < weeks) buckets[w].outflow += +bill.Balance;
  }
  let running = openingCash;
  for (const b of buckets) {
    running += b.inflow - b.outflow;
    b.endingCash = running;
  }
  return buckets;
}
```

The `current cash` input is computed via `format_currency`'s sum of bank-account balances (we also need a `sum_field_where` system helper, which Xero already has — confirm before duplicating).

### Bank-account breakdown drawer

Below the chart, a collapsible `Accordion` listing each bank/CC account with its name, type, `CurrentBalance`, and `LastUpdated`. Clicking an account opens an overlay with the most recent 25 transactions via `list_purchase` + `list_deposit` filtered by `AccountRef`. This is a stretch goal — defer unless we have time.

### Computed helpers needed

```
qbo-accounting_weekly_cash_projection({ openingCash, invoices, bills, weeks })  → buckets[]
qbo-accounting_runway_weeks(buckets, currentCash)                              → number | "∞"
qbo-accounting_first_negative_week(buckets)                                    → number | null
sum_field_where (system helper — confirm it exists, else create)
```

### Edge cases

- No bank accounts → "Connect a bank account in QBO to enable the forecast." link to `https://qbo.intuit.com/banking`
- All bank balances stale > 7 days → warning eyebrow under headline ("Balances last updated 12 days ago")
- Multi-currency → forecast in the company's home currency only; flag a caption if any invoices/bills are foreign-currency and they'll be approximated at the historical rate stored on the document

---

## Widget 3 — Month-End Close Checklist

**Slug:** `qbo-close-checklist`
**Title:** "Month-End Close Checklist"
**Category:** `productivity`
**Sizing:** preferred `5×5`, min `4×4`, max `8×10`

### Why this widget

Surveyed accountants take 6+ days to close; the universally-cited drag is hygiene issues hiding in the books — unapplied payments, undeposited funds, draft invoices, negative balances, missing categorizations. None of these surface naturally in QBO's dashboard. This widget is a live checklist that hunts them down and links the user straight to the fix.

### Layout

```
┌─ Header ────────────────────────────────────────────┐
│ ✓ Month-End Close Checklist     {n} issues found    │
│   Period: April 2026                                │
├─ Body (Stack) ──────────────────────────────────────┤
│ ⚠ Undeposited funds balance              $4,250.18 ▸│
│ ⚠ Unapplied customer payments      (12)  $3,140.00 ▸│
│ ⚠ Unapplied vendor credits          (3)    $612.00 ▸│
│ ✓ Draft transactions                  0           — │
│ ⚠ Customers with negative balances    (2)    $94.20 ▸│
│ ✓ Bills past due > 60 days            0           — │
│ ⚠ Uncategorized expense bucket        $1,200.00    ▸│
│ ✓ Period closing date set         Apr 30, 2026    — │
└─────────────────────────────────────────────────────┘
```

Each row is a `ChecklistItem` composite component (new). Status icon + label + count chip + value + chevron. Clicking a non-zero row pushes the relevant `/ui/qbo-close/drilldown` state and opens an overlay with the raw matching records.

### Period selector

Top-right `Select` with options: This Month, Last Month (default), Custom. Stored at `/ui/qbo-close/period`; a `watch` re-runs all checks.

### The eight checks

Each is a single `qbo_query` or single tool call. All are watched for re-fire when `period` changes.

| Check | Query | Pass criteria |
|---|---|---|
| Undeposited funds balance | `get_account` on the UndepositedFunds account (find it via `list_account WHERE AccountType = 'Other Current Asset' AND AccountSubType = 'UndepositedFunds'`); read `CurrentBalance` | `= 0` |
| Unapplied customer payments | `list_payment WHERE UnappliedAmt > '0' AND TxnDate BETWEEN '<start>' AND '<end>'` | empty |
| Unapplied vendor credits | `list_vendor_credit WHERE Balance > '0' AND TxnDate BETWEEN '<start>' AND '<end>'` | empty |
| Draft transactions | `list_invoice WHERE TxnStatus = 'Draft'` (combine with `Estimate`, `PurchaseOrder`) | empty |
| Customers w/ negative balance | `list_customer WHERE Balance < '0'` | empty |
| Bills past due > 60 days | `list_bill WHERE Balance > '0' AND DueDate < '<today-60>'` | empty |
| Uncategorized expenses | `qbo_query SELECT * FROM Purchase WHERE AccountRef = '<uncategorized_account_id>'` (resolve account by name first) | empty |
| Period closing date set | `get_preferences` → `AccountingInfoPrefs.BookCloseDate` exists and ≥ period end | truthy |

Each check writes a result object to `/ui/qbo-close/results/<checkKey>` shaped `{ status: 'pass'|'fail', count, value, drilldown: [...] }`. The row reads from there.

### Drilldown overlay

Common pattern: when the user clicks a failing row, the overlay opens a small `Table` of the offending rows with a "Fix in QBO" link that opens a deep link (`https://qbo.intuit.com/app/<entity>?txnId=<Id>`). For unapplied payments, also offer an inline `Apply to invoice` button — but this is non-trivial because applying requires building a `Payment.Line` mapping. Defer to v2; v1 shows the records and links out.

### Export action

Top-right `Button` "Export checklist" → calls a future widget action to produce a one-page PDF or CSV. Stub action for now; render the button but disable it with tooltip "Coming soon" if the action isn't wired.

### Computed helpers needed

```
qbo-accounting_period_bounds(period: 'this'|'last'|'custom', start?, end?) → { start, end, label }
qbo-accounting_close_status_tone(check)                                    → 'success'|'warning'|'destructive'
qbo-accounting_close_status_icon(check)                                    → 'CircleCheck'|'AlertTriangle'|'Circle'
```

Composite component `qbo-accounting/ChecklistItem` packages the row layout so the eight checks each render in two lines of JSON.

### Edge cases

- A check errors out → row shows `?` icon + "Couldn't check" caption; doesn't block the others
- The Undeposited Funds account doesn't exist (rare — non-US locales) → check is skipped silently
- Closing date is a string `"YYYY-MM-DD"` — compare lexicographically to the period end since both are ISO

---

## Widget 4 — P&L vs Prior Period Pulse

**Slug:** `qbo-pnl-vs-prior`
**Title:** "P&L vs Prior Period"
**Category:** `finance`
**Sizing:** preferred `6×5`, min `5×4`, max `12×10`

### Why this widget

Every accountant runs the comparative P&L weekly. The entire Fathom / LiveFlow product category is built on a richer version of this view. QBO's stock comparative is buried in custom reports. This widget puts the comparison front-and-center with auto-variance, top movers, and a 12-month sparkline of net income.

### Headline

Two segmented controls in the eyebrow:

- **Period** — `MTD` (default) / `QTD` / `YTD` / `Last Month` / `Last Quarter`
- **Compare to** — `Prior Year` (default) / `Prior Period` / `Budget`

State paths: `/ui/qbo-pnl/period` and `/ui/qbo-pnl/compare`.

### Data sources

| Tool | Params | Why |
|---|---|---|
| `get_report_profit_and_loss` | `date_macro: "<current>"` (mapped from period control), `summarize_column_by: "Total"` | Current-period totals |
| `get_report_profit_and_loss` | `date_macro: "<prior>"` (mapped from compare control), `summarize_column_by: "Total"` | Comparison totals |
| `get_report_profit_and_loss` | `start_date: "<12 months ago>"`, `end_date: "today"`, `summarize_column_by: "Month"` | Sparkline |
| `get_report_budget_summary` (only if `compare === 'Budget'`) | `date_macro: "<current>"` | Budget comparison |

The three calls fire in parallel; the budget call is conditional. Each lands at a distinct state path (`/quickbooks-accounting/get_report_profit_and_loss/...` — but we need three of them, so use `Result Key Suffixes`: confirm whether the runtime can dispatch the same tool to three distinct state buckets; if not, write a thin wrapper widget-action `qbo-accounting.pnl_compare` that returns all three in one call).

### KPI strip (Grid cols=4)

For each metric: large value + variance arrow + variance `$` and `%`.

1. **Revenue** — "Total Income"; up arrow success, down arrow destructive
2. **Gross Profit** — "Gross Profit"
3. **Operating Expenses** — "Total Expenses"; up arrow destructive, down arrow success (inverted)
4. **Net Income** — "Net Income"; standard tone

`qbo-accounting_variance({ current, prior })` returns `{ delta, pct, tone, arrow }`.

### Body — top movers + sparkline

**Left column (60%):** Sparkline. `LineChart` element with the 12-month net income series, current period highlighted. Below the chart: caption "Net income trailing 12 months."

**Right column (40%):** "Top movers" table. The widget computes which line items moved most in $ between current and prior; renders top 5 increases (success) and top 5 decreases (destructive). Each row: line title, current $, prior $, delta $, delta %.

### Computed helpers needed

```
qbo-accounting_period_to_date_macro(period, basis: 'current'|'prior') → string
   // 'MTD'+'current' → 'This Month-to-date'
   // 'MTD'+'prior'   → 'Last Year This Month' (if compare='Prior Year')
   //                 → 'Last Month-to-date'   (if compare='Prior Period')

qbo-accounting_variance({ current, prior, invert?: boolean }) → { delta, pct, tone, arrow }
qbo-accounting_top_movers(currentRows, priorRows, n: 5)       → [{ title, current, prior, delta, pct, tone }]
qbo-accounting_pnl_extract(report, lineName)                  → number   // wraps flatten + find
```

### Edge cases

- Prior period has $0 revenue → variance % is `—`, not `Infinity%`
- Budget unavailable for the period → fall back to Prior Year and surface a caption
- Multiple currencies → P&L report is always in home currency; no extra handling needed
- A "Total Income" row missing (rare — empty company) → render `$0.00` and a caption "No income recorded for the selected period"

---

## Widget 5 — Top Customers & Customers At Risk

**Slug:** `qbo-customer-watch`
**Title:** "Top Customers & At-Risk"
**Category:** `finance`
**Sizing:** preferred `5×5`, min `4×4`, max `10×10`

### Why this widget

Customer concentration risk is the single most-requested CAS deliverable after the cash forecast. Accountants want to know: *who pays the bills, and which of them are starting to drift?* Combining a top-customers list with an at-risk heuristic in one widget produces an artifact that's instantly client-ready.

### Layout

Tabbed view via `Tabs` element (state path `/ui/qbo-customer-watch/tab`):

- **Tab 1 — Top by revenue (YTD)** — default
- **Tab 2 — At risk** — flagged customers

```
┌─ Header ────────────────────────────────────────────┐
│ 👥 Top Customers & At-Risk     YTD · 5 of 247       │
├─ Tabs ──────────────────────────────────────────────┤
│ [ Top by revenue ] [ At risk (3) ]                  │
├─ Body ──────────────────────────────────────────────┤
│ Tab 1:                                              │
│ 1. ACME Corp        $48,200   28% ▆▆▆▆▆▆▆▆          │
│ 2. Beta LLC         $31,400   18% ▆▆▆▆▆             │
│ 3. Gamma Inc        $22,150   13% ▆▆▆▆              │
│ 4. Delta Co         $18,800   11% ▆▆▆               │
│ 5. Epsilon Ltd      $14,900    9% ▆▆▆               │
│    ── Other (242)   $34,600   21%                   │
│                                                     │
│ Tab 2:                                              │
│ 🔴 ACME Corp     Avg DTP up 18d → 42d  Bal +35%    │
│ 🟠 Delta Co      Concentration 11%, 2 invoices 60+ │
│ 🟡 Foxtrot Inc   No invoice in 90 days              │
└─────────────────────────────────────────────────────┘
```

### Headline

Eyebrow: "YTD · {top5pct}% of revenue from top 5". `qbo-accounting_concentration_top_n(rows, n: 5)` returns the percent.

### Data sources

| Tool | Params | Why |
|---|---|---|
| `get_report_customer_sales` | `date_macro: "This Year-to-date"`, `summarize_column_by: "Customer"` | Top by revenue |
| `get_report_customer_sales` | `date_macro: "Last Year-to-date"`, `summarize_column_by: "Customer"` | Year-over-year comparison for top customers |
| `get_report_aged_receivable_detail` | `report_date: "today"` | Per-customer open balance + per-invoice details |
| `list_payment` | `where: "TxnDate > '<6 months ago>'"`, `maxResults: 1000` | Days-to-pay calculation (need linked InvoiceRef + TxnDate vs invoice TxnDate) |
| `list_invoice` | `where: "TxnDate > '<6 months ago>'"`, `maxResults: 1000` | Pair with payments to compute DTP |
| `get_customer` (on row click) | `id` | Detail overlay |

### At-risk heuristic

A customer is flagged if any of:

| Flag | Trigger | Severity |
|---|---|---|
| 🔴 Slowing payment | 90-day rolling avg days-to-pay rose by ≥ 14 days vs prior 90 days | Red |
| 🟠 Concentration | Contributes ≥ 10% of YTD revenue AND has ≥ 1 invoice 60+ days late | Orange |
| 🟡 Going quiet | No new invoice in 90+ days AND prior 12 months had > $5k revenue | Yellow |
| 🔴 Balance ballooning | Open balance grew ≥ 25% over last 90 days | Red |

The widget-element function `qbo-accounting_customer_risk_flags({ customers, invoices, payments, salesYtd })` produces a deduplicated list of customers with their flag set, sorted red→orange→yellow.

### Row rendering

**Top tab:** rank + customer name + revenue $ + % of total + horizontal bar (width = % of top1). On click, open overlay with customer detail + 12-month revenue trend + open invoices list.

**At-risk tab:** severity dot + customer name + flag description (e.g. "Avg DTP up 18d → 42d") + open-balance amount. On click, same overlay.

### Detail overlay

- KeyValues: PrimaryEmailAddr, BillAddr summary, currency, terms, open balance, YTD revenue
- "Recent invoices" sub-table (last 10) with status
- Actions: "Email statement" (calls a wrapper widget-action that bundles open invoices into one email — defer to v2; render as disabled in v1), "Open in QBO" (deep link)

### Computed helpers needed

```
qbo-accounting_customer_risk_flags({customers, invoices, payments, salesYtd}) → flagged[]
qbo-accounting_days_to_pay(invoices, payments)                                 → Map<customerId, {avg, rolling90, prior90}>
qbo-accounting_concentration_top_n(rows, n)                                    → number   // % of total
qbo-accounting_pct_of_total(value, total)                                      → number
```

### Edge cases

- Brand-new business with < 5 customers → render whatever's there; no "Other" row needed
- Customer with no payments yet → exclude from "slowing payment" flag, but show in concentration if applicable
- Customer is inactive in QBO → exclude unless they had revenue in the period

---

## Build sequence & shared work

| Sprint | Build | Reuses |
|---|---|---|
| 1 | Widget 1 (AR Aging Cockpit) + shared helpers: `flatten_report_rows`, `format_date`, `overdue_tone`/`overdue_label`, `today_minus_days`, `dso` | — |
| 2 | Widget 4 (P&L vs Prior) — most helpers already exist | flatten, format_currency |
| 3 | Widget 3 (Close Checklist) + `ChecklistItem` composite component | format_date, today_minus_days |
| 4 | Widget 2 (Cash Runway) + weekly projection helpers + LineChart wiring | format_currency, format_date |
| 5 | Widget 5 (Customer Watch) + risk-flag helpers + tabs scaffolding | concentration, days_to_pay |

Total estimate: 5 widgets, ~25 widget-element helper functions, 1 composite component (`ChecklistItem`). All reuse the same Card / Header / Stats / Body / Overlay skeleton.

---

## Open questions to resolve before build

1. **Does the runtime allow the same MCP tool to be called multiple times with different params, landing at distinct state paths?** Widget 4 needs three concurrent `get_report_profit_and_loss` calls. If not, we need a wrapper widget-action.
2. **Does a `sum_field_where` system helper exist?** Widget 2's current-cash math needs it. The Xero plugin uses inline `$computed: "sum"` with `whereField`/`startsWith` — if that helper is in the system baseline, we reuse it.
3. **Is there a `LineChart` element in the system widget library?** Widgets 2 and 4 both need one. If not, we either add it to the baseline or render a `Sparkline` composite from primitives.
4. **`Tabs` element availability?** Widget 5 wants a tab control. If absent, fall back to a `SegmentedControl` driving body visibility.
5. **QBO deep-link patterns** — confirm the exact URL shape for `https://qbo.intuit.com/app/<entity>?txnId=<Id>` per entity type (Invoice, Bill, Payment, Customer). Some entities use different routes.

Resolve these in a prototype pass before fully writing widget 1.
