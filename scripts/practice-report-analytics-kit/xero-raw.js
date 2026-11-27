// Test fixtures in Xero's own response shapes (what the xero-api connector passes through unchanged), for the
// per-organisation fan-out in xero-fan.js. `orgs(list)` turns per-organisation answers into the harness's fixture map:
// every x_* binding is dispatched on its xero_tenant_id param (empty = the first organisation, as the connector's
// discovered default does on open).

// An invoice or bill. due: 'YYYY-MM-DD'.
const inv = (amountDue, due, contact, status) => ({ Status: status || 'AUTHORISED', AmountDue: amountDue, DueDateString: due + 'T00:00:00', Contact: { ContactID: contact || 'c-1', Name: contact || 'c-1' } });
const invoices = (list) => ({ Invoices: list });
// A list endpoint answered with page=1: Xero's pagination block carries the full item count.
const counted = (key, n) => ({ pagination: { page: 1, pageSize: 100, pageCount: Math.max(1, Math.ceil(n / 100)), itemCount: n }, [key]: [] });
const accounts = (bank, other) => ({ Accounts: [].concat(Array.from({ length: bank }, (_, i) => ({ Type: 'BANK', Name: 'Bank ' + (i + 1) })), Array.from({ length: other }, (_, i) => ({ Type: 'EXPENSE', Name: 'Expense ' + (i + 1) }))) });
const cell = (v) => ({ Value: String(v) });
// Bank Summary rows: [Name, Opening, CashReceived, CashSpent, Closing], with Xero's Total summary row.
const bankSummary = (accts) => {
  const rows = accts.map((a) => ({ RowType: 'Row', Cells: [cell(a.name), cell(a.open || 0), cell(a.in), cell(a.out), cell(a.close)] }));
  const sum = (k) => accts.reduce((s, a) => s + (a[k] || 0), 0);
  rows.push({ RowType: 'SummaryRow', Cells: [cell('Total'), cell(sum('open')), cell(sum('in')), cell(sum('out')), cell(sum('close'))] });
  return { Reports: [{ ReportID: 'BankSummary', Rows: [{ RowType: 'Header', Cells: [] }, { RowType: 'Section', Title: '', Rows: rows }] }] };
};
// Profit and Loss in Xero's live shape: titled sections with SummaryRows, and Gross/Net Profit as plain Rows in an
// untitled section (as seen on QA, 16 Nov 2026).
const pl = ({ income, cos, gp, np }) => {
  const sec = (title, total) => ({ RowType: 'Section', Title: title, Rows: [{ RowType: 'Row', Cells: [cell(title + ' line'), cell(total)] }, { RowType: 'SummaryRow', Cells: [cell('Total ' + title), cell(total)] }] });
  const rows = [{ RowType: 'Header', Cells: [] }, sec('Income', income)];
  if (cos != null) rows.push(sec('Less Cost of Sales', cos));
  const tail = [];
  if (gp != null) tail.push({ RowType: 'Row', Cells: [cell('Gross Profit'), cell(gp)] });
  if (np != null) tail.push({ RowType: 'Row', Cells: [cell('Net Profit'), cell(np)] });
  if (tail.length) rows.push({ RowType: 'Section', Title: '', Rows: tail });
  return { Reports: [{ ReportID: 'ProfitAndLoss', Rows: rows }] };
};
// Bank transactions with the given totals (one page of up to 100).
const bankTx = (totals) => ({ BankTransactions: totals.map((t) => ({ Total: t, IsReconciled: false })) });

// list: [{ tenantId, tenantName, updatedDateUtc?, fx: { <bindingId>: (params) => response } }]
function orgs(list, extra) {
  const byId = Object.fromEntries(list.map((o) => [o.tenantId, o]));
  const fx = { xero_connections: () => list.map((o) => ({ id: 'conn-' + o.tenantId, tenantId: o.tenantId, tenantType: 'ORGANISATION', tenantName: o.tenantName, updatedDateUtc: o.updatedDateUtc })) };
  const ids = new Set(list.flatMap((o) => Object.keys(o.fx || {})));
  ids.forEach((id) => {
    fx[id] = (p) => {
      const o = byId[p.xero_tenant_id] || (!p.xero_tenant_id ? list[0] : null);
      if (!o) throw new Error('Xero 403: tenant not connected');
      const f = o.fx[id];
      if (!f) throw new Error('no fixture for ' + id + ' on ' + o.tenantId);
      return f(p);
    };
  });
  return Object.assign(fx, extra || {});
}

module.exports = { inv, invoices, counted, accounts, bankSummary, pl, bankTx, orgs };
