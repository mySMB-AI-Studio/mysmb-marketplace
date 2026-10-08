// Every report template the Practice Report Analytics extension ships. gen.js writes each one to
// plugins/practice-report-analytics/reports/<slug>/ (report.json + report.html); the catalogue, skills
// and tests read the same list.
const PLATFORM = { xero: 'Xero', myob: 'MYOB', quickbooks: 'QuickBooks' };
const ITEMS = {
  'client-summary': { pra: 'PRA-01', name: 'Client Summary Metrics', chip: 'Clients',
    blurb: 'Counts of contacts, accounts, invoices, bills and employees per client — the practice’s one-page inventory.' },
  'sales-summary': { pra: 'PRA-02', name: 'Sales Summary Metrics', chip: 'Sales',
    blurb: 'Outstanding and overdue invoice counts and values, collection days (DSO) and average invoice value, per client.' },
  'purchases-summary': { pra: 'PRA-03', name: 'Purchases Summary Metrics', chip: 'Purchases',
    blurb: 'Outstanding and overdue bills, payment days (DPO) and supplier counts, per client.' },
  'bank-reconciliation-summary': { pra: 'PRA-04', name: 'Bank Reconciliation Summary', chip: 'Banking',
    blurb: 'Statement vs ledger balance, unreconciled lines and last-reconciled date, across every client and bank account.' },
  'banking-summary': { pra: 'PRA-05', name: 'Banking Summary Metrics', chip: 'Banking',
    blurb: 'Cash in, cash out and net movement across every bank account, per client.' },
  'financial-overview': { pra: 'PRA-06', name: 'Financial Overview', chip: 'Financial',
    blurb: 'Revenue, gross and net profit, bank balances and AR/AP ageing, for all or selected clients on one page.' }
};
const REPORTS = [{
  pra: 'PRA-00', ref: 'catalogue/practice-catalogue', slug: 'practice-report-catalogue', table: false,
  title: 'Practice Report Catalogue',
  description: 'Practice Report Analytics catalogue (PRA-00): every practice-wide report as a box, grouped by Clients, Sales, Purchases, Banking, Financial, Quality, Work and Time, with what is live now and how to open it, plus the Work list box.',
  tags: ['practice-report-analytics', 'catalogue', 'PRA-00']
}];
for (const id of Object.keys(ITEMS)) {
  const it = ITEMS[id];
  REPORTS.push({
    pra: it.pra, ref: 'reports/' + id, slug: 'practice-' + id, table: true, item: id,
    title: 'Practice ' + it.name,
    description: 'Practice Report Analytics ' + it.pra + ': ' + it.blurb + ' One row per client across Xero, MYOB and QuickBooks. Live, validated; mySMB branding by default.',
    tags: ['practice-report-analytics', it.pra, id]
  });
}
REPORTS.forEach((r) => { r.fileName = r.slug + '.html'; });
module.exports = { REPORTS, ITEMS, PLATFORM, PLUGIN: 'practice-report-analytics' };
