// CRA-03/04 Sales/Purchases by Tracking Category (QuickBooks): quickbooks-reporting-kit/fixtures.js has no Classes-columned
// Profit and Loss fixture to reuse (no QBO report in that kit splits by class yet), so this is this CRA kit's own derivation:
// it takes the real F.pnl() fixture's Total-only figures (so the Total column always ties to the real "pnl" binding by
// construction) and splits each Income / Cost of Sales / Expenses leaf 50% North / 30% South / 20% Unclassified. The real
// QuickBooks Online Reports API does support `summarize_column_by: "Classes"` on get_report_profit_and_loss (same report,
// different column split), so the binding itself is real; only this test fixture's class split is invented for testing.
const F = require('../../quickbooks-reporting-kit/fixtures.js');
const r2 = (n) => Math.round(n * 100) / 100;
const CLASS_COLS = [{ ColTitle: 'North', ColType: 'Money', MetaData: [{ Name: 'ColKey', Value: 'north' }] }, { ColTitle: 'South', ColType: 'Money', MetaData: [{ Name: 'ColKey', Value: 'south' }] }, { ColTitle: 'Unclassified', ColType: 'Money', MetaData: [{ Name: 'ColKey', Value: 'unclassified' }] }, { ColTitle: 'Total', ColType: 'Money', MetaData: [{ Name: 'ColKey', Value: 'total' }] }];
function splitLeaf(row) {
  const total = Number(row.ColData[1].value), north = r2(total * 0.5), south = r2(total * 0.3), uncl = r2(total - north - south);
  return Object.assign({}, row, { ColData: [row.ColData[0], { value: north.toFixed(2) }, { value: south.toFixed(2) }, { value: uncl.toFixed(2) }, { value: total.toFixed(2) }] });
}
function sumCols(rows) { const t = [0, 0, 0, 0]; rows.forEach((r) => { for (let i = 0; i < 4; i++) t[i] += Number(r.ColData[i + 1].value); }); return t.map(r2); }
// Splits ONE named Section (by its `group`, e.g. "Income") into class columns; every other section is left untouched.
function splitSection(rep, group) {
  const sec = rep.Rows.Row.find((r) => r.group === group); if (!sec) return rep;
  const rows = (sec.Rows.Row || []).map(splitLeaf), totals = sumCols(rows);
  const newSec = Object.assign({}, sec, { Header: { ColData: [sec.Header.ColData[0], { value: '' }, { value: '' }, { value: '' }, { value: '' }] }, Rows: { Row: rows }, Summary: { ColData: [sec.Summary.ColData[0]].concat(totals.map((v) => ({ value: v.toFixed(2) }))) } });
  const newCols = { Column: [rep.Columns.Column[0]].concat(CLASS_COLS) };
  return Object.assign({}, rep, { Columns: newCols, Rows: { Row: rep.Rows.Row.map((r) => (r === sec ? newSec : r)) }, Header: Object.assign({}, rep.Header, { SummarizeColumnsBy: 'Classes' }) });
}
function pnlByClassIncome(p) { return splitSection(F.pnl(Object.assign({}, p, { summarize_column_by: 'Total' })), 'Income'); }
// Cost of Sales + Expenses as one combined "section" for CRA-04 (two real QBO sections): split each separately, same columns.
function pnlByClassSpend(p) {
  const base = F.pnl(Object.assign({}, p, { summarize_column_by: 'Total' }));
  const withCogs = splitSection(base, 'COGS');
  return splitSection(withCogs, 'Expenses');
}
module.exports = { pnlByClassIncome, pnlByClassSpend };
