// Every report template the Client Report Analytics extension ships, in catalogue order. gen.js writes each one to
// plugins/client-report-analytics/reports/<slug>/ (report.json + report.html); the catalogue, the skills and the
// tests read the same list, so a slug or title is written once.
const fs = require('fs'), path = require('path');
const PLATFORM = { xero: 'Xero', myob: 'MYOB', quickbooks: 'QuickBooks' };
const ITEMS = {
  'financial-overview': {
    cra: 'CRA-01', name: 'Financial Overview', chip: 'Financial',
    blurb: 'revenue, gross and net profit with margins against last year, bank balances and receivables / payables ageing, cash or accrual.'
  },
  'tax-by-type': {
    cra: 'CRA-05', name: 'Summary of Tax Amounts by Type', chip: 'Tax & BAS',
    blurb: 'GST by tax type for each month of the period, with period totals reconciled to the GST figures (BAS preparation review).'
  },
  'bas-transactions': {
    cra: 'CRA-07', name: 'BAS Related Transactions and GST', chip: 'Tax & BAS',
    blurb: 'every BAS-relevant transaction line by tax type, with contact, source and GL account, and totals that tie to the GST figures.'
  },
  'sales-by-tracking': {
    cra: 'CRA-03', name: 'Sales by Tracking Category', chip: 'Sales & purchases',
    blurb: 'sales split by one tracking category / class / job at a time, with each option\'s share of the total, tied to the platform\'s own sales figure.'
  },
  'purchases-by-tracking': {
    cra: 'CRA-04', name: 'Purchases by Tracking Category', chip: 'Sales & purchases',
    blurb: 'purchases and spend split by one tracking category / class / job at a time, with each option\'s share of the total, tied to the platform\'s own purchases figure.'
  },
  'contacts-bas': {
    cra: 'CRA-06', name: 'Contact Details for BAS Preparation', chip: 'Tax & BAS',
    blurb: 'every contact with the tax types used on their transactions and GST evidence on file, and on Xero each ABN\'s Australian Business Register record (needs ABR Lookup connected).'
  },
  'activity-count': {
    cra: 'CRA-11', name: 'Activity Count', chip: 'Activity',
    blurb: 'transaction counts by month across sales, purchases, banking, payroll and journals, so you can see how active the file has been.'
  },
  // The live-checks reports: the overnight checks engine's rules (Bookkeeping for Xero) run on the client's ledger as the
  // report opens (shared/live-checks.js), so they are live on all three platforms, not only the weekly Xero artifact.
  'data-quality': {
    cra: 'CRA-02', name: 'Data Quality', chip: 'Quality',
    blurb: 'every finding of the checks on this client\'s ledger, run live as the report opens with the overnight checks engine\'s rules, by category and severity, with $ at risk and what was checked.'
  },
  'client-queries': {
    cra: 'CRA-08', name: 'Client Queries', chip: 'Quality',
    blurb: 'the transactions the client has to explain or send something for (missing receipts, missing ABNs, uncoded and unexplained lines), listed with what is needed and drafted ready to send.'
  },
  'health-check': {
    cra: 'CRA-09', name: 'Health Check', chip: 'Quality',
    blurb: 'income, profit, bank, overdue receivables and payables, and the data quality findings, on one page.'
  },
  'gst-check': {
    cra: 'CRA-10', name: 'GST Check', chip: 'Tax & BAS',
    blurb: 'the scope and method of every GST check, which are clear and which carry GST risk, with the GST at risk.'
  },
  // Time from the client's own file: MYOB timesheets and QuickBooks time activities (Xero's accounting API has none). This
  // is the client's staff time, not the practice's time on the client, which needs a practice-management time source.
  'actual-time': {
    cra: 'CRA-12', name: 'Actual Time', chip: 'Time', platforms: ['myob', 'quickbooks'],
    blurb: 'hours recorded in the client\'s own file by person, job or customer and activity, by month (the client\'s staff time, not the practice\'s time on the client).'
  },
  'estimate-accuracy': {
    cra: 'CRA-13', name: 'Estimate Accuracy', chip: 'Time', platforms: ['quickbooks'],
    blurb: 'each estimate against the invoices raised from it, with the variance in dollars (QuickBooks has no time estimates).'
  }
  // CRA-15 Workspace User Activity has no template: workq_activity is workspace-wide counts per user with no client link
  // (live QA 2026-10-13), so the catalogue box routes to the platform's built-in Workspace Activity report instead.
};
const REPORTS = [{
  cra: 'CRA-00', ref: 'catalogue/client-catalogue', slug: 'client-report-catalogue', platform: null,
  title: 'Client Report Catalogue',
  description: 'Client Report Analytics catalogue (CRA-00): pick a client from your Xero, MYOB or QuickBooks connections and see every client report as a box, grouped by Financial, Tax & BAS, Sales & purchases, Quality, Activity, Time and Platform reports, with what is live now and how to open it.',
  tags: ['client-report-analytics', 'catalogue', 'CRA-00', 'CRA-16']
}];
// A template exists when its config does: a platform an item doesn't cover (it.platforms) or hasn't been written yet is left out.
for (const id of Object.keys(ITEMS)) for (const p of Object.keys(PLATFORM)) {
  const it = ITEMS[id];
  if ((it.platforms && !it.platforms.includes(p)) || !fs.existsSync(path.join(__dirname, p, id + '.cfg.js'))) continue;
  REPORTS.push({
    cra: it.cra, ref: p + '/' + id, slug: 'client-' + p + '-' + id, platform: p, item: id,
    title: PLATFORM[p] + ' ' + it.name,
    description: 'Client Report Analytics ' + it.cra + ' for one ' + PLATFORM[p] + ' client: ' + it.blurb + ' Live and validated on every open; mySMB branding by default.',
    tags: ['client-report-analytics', it.cra, p, id]
  });
}
REPORTS.forEach((r) => { r.fileName = r.slug + '.html'; });
module.exports = { REPORTS, ITEMS, PLATFORM, PLUGIN: 'client-report-analytics' };
