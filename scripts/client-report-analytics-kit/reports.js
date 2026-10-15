// Every report template the Client Report Analytics extension ships, in catalogue order. gen.js writes each one to
// plugins/client-report-analytics/reports/<slug>/ (report.json + report.html); the catalogue, the skills and the
// tests read the same list, so a slug or title is written once.
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
  }
  // CRA-15 Workspace User Activity is not built: the platform's workq_activity data is workspace-wide counts per user over
  // the last N days, with no client link and no date range, so a per-client report cannot be honest yet (live QA 2026-10-13).
};
const REPORTS = [{
  cra: 'CRA-00', ref: 'catalogue/client-catalogue', slug: 'client-report-catalogue', platform: null,
  title: 'Client Report Catalogue',
  description: 'Client Report Analytics catalogue (CRA-00): pick a client from your Xero, MYOB or QuickBooks connections and see every client report as a box, grouped by Financial, Tax & BAS, Sales & purchases, Quality, Activity, Time and Platform reports, with what is live now and how to open it.',
  tags: ['client-report-analytics', 'catalogue', 'CRA-00', 'CRA-16']
}];
for (const id of Object.keys(ITEMS)) for (const p of Object.keys(PLATFORM)) {
  const it = ITEMS[id];
  REPORTS.push({
    cra: it.cra, ref: p + '/' + id, slug: 'client-' + p + '-' + id, platform: p, item: id,
    title: PLATFORM[p] + ' ' + it.name,
    description: 'Client Report Analytics ' + it.cra + ' for one ' + PLATFORM[p] + ' client: ' + it.blurb + ' Live and validated on every open; mySMB branding by default.',
    tags: ['client-report-analytics', it.cra, p, id]
  });
}
REPORTS.forEach((r) => { r.fileName = r.slug + '.html'; });
module.exports = { REPORTS, ITEMS, PLATFORM, PLUGIN: 'client-report-analytics' };
