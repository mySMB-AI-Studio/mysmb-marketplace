// PRA-12 User Activity: "what people have been doing in client files" — ledger audit-log events per
// user/client/period, where the platform exposes one. Layout family is "practice table" (no heat strip).
//
// Honest platform-gap judgement call (documented here and in the PR, not silently guessed around):
// neither Xero's accounting API nor MYOB's AccountRight API exposes a practice-wide, bulk audit-log or
// history feed through this connector —
//   - Xero's History & Notes API (api/history.ts, listHistory) is PER-RECORD only
//     (/<HostType>/{hostId}/History): fetching it practice-wide would mean one call per invoice, bill,
//     contact etc per client — many thousands of calls, far past this report's 5s typical / 45s hard
//     ceiling budget, and not something any existing per-client report does either.
//   - MYOB's AccountRight API has no general audit-log or "journal security audit" endpoint in this
//     connector (confirmed: no audit/security export among its documented, implemented methods).
//   - QuickBooks does have a real per-company Audit Log API, but QuickBooks is one company per
//     connection and is excluded from every practice-wide report in this agent (same exclusion as
//     PRA-01..06 — there is nothing to consolidate across clients for a single company).
// So this report reuses the EXISTING get_practice_client_summary tool (no new server-side tool) for
// the one genuine per-client signal both platforms can cheaply offer — a connection-level last-sync
// timestamp — labelled precisely as that, not as ledger "user activity", so no one mistakes a
// connection metadata field for an audit event. "Events by user" and "Edits / deletes" are shown as a
// named, reasoned N/A on every row via staticNA, per the never-fabricate rule, with the full
// explanation surfaced once via `notice`.
const { buildPracticeTable } = require('../practice-table-kit.js');

module.exports = function build() {
  return buildPracticeTable({
    title: 'Practice User Activity',
    slug: 'practice-user-activity',
    tool: 'get_practice_client_summary', // named in the footer and the Excel Parameters sheet
    chips: [],
    sources: { xero: 'xero', myob: 'myob' },
    qbNote: 'one company per connection — QuickBooks’ own Audit Log is per-company; ask the Client Report Analytics agent.',
    notice: 'Neither Xero nor MYOB exposes a practice-wide, bulk audit-log/history API through this connector: Xero’s History & Notes endpoint is per-record only (one call per invoice, bill or contact — not practical across a whole practice); MYOB’s AccountRight API has no general audit-log endpoint. QuickBooks’ Audit Log is per-company and is excluded from every practice-wide report, the same exclusion as PRA-01–06. “Last synced” below is the closest genuine signal available until a bulk audit feed exists — it is a connection-level timestamp, not a ledger event.',
    staticNA: {
      events: 'No platform in this connector exposes a practice-wide, bulk audit-log/history API to count events by user — see the notice above.',
      edits_deletes: 'No platform in this connector exposes a practice-wide edit/delete audit trail — see the notice above.'
    },
    // get_practice_client_summary already agrees on the field name (lastSync / lastSync_na) on both
    // platforms — identity alias, kept explicit so a rename on either side is caught by the tests.
    fieldAliases: {
      xero: { last_sync: 'lastSync' },
      myob: { last_sync: 'lastSync' }
    },
    columns: [
      { key: 'last_sync', label: 'Last synced (connection)' },
      { key: 'events', label: 'Events by user' },
      { key: 'edits_deletes', label: 'Edits / deletes' }
    ],
    totals: []
  });
};
