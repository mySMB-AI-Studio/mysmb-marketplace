/**
 * myconnect-community-admin — widget-elements module
 * ──────────────────────────────────────────────────────────────────
 * Contributed `$computed` helpers and actions. The host prepends the
 * slug `myconnect-community-admin_` to every name, so e.g. the
 * spec-side reference is `myconnect-community-admin_today`.
 */
// ── today ────────────────────────────────────────────────────────────
// Today's date, UTC, as YYYY-MM-DD -- matches the YYYY-MM-DD shape
// get_signups_in_range/list_members already expect for fromDate/toDate.
// No args.
//
// Spec example:
//   { "$computed": "myconnect-community-admin_today" }
const today = () => new Date().toISOString().slice(0, 10);
// ── is_after ─────────────────────────────────────────────────────────
// True when YYYY-MM-DD string `a` is chronologically after `b` (plain
// string compare -- safe because the format is fixed-width). json-render's
// own `$cond` gt/lt only compare numbers, so a "fromDate after toDate"
// check needs this rather than a bare $cond.
//
// Args: { a: string, b: string }
//
// Spec example:
//   { "$computed": "myconnect-community-admin_is_after", "args": { "a": {"$state":"/ui/fromDate"}, "b": {"$state":"/ui/toDate"} } }
const is_after = (args) => {
    const a = String(args.a ?? '');
    const b = String(args.b ?? '');
    if (!a || !b)
        return false;
    return a > b;
};
function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    }[c] ?? c));
}
function sharePct(part, whole) {
    if (!Number.isFinite(whole) || whole <= 0)
        return '0%';
    return `${Math.round((part / whole) * 1000) / 10}%`;
}
function titleCase(s) {
    return s
        .replace(/[_-]+/g, ' ')
        .trim()
        .split(/\s+/)
        .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
        .join(' ');
}
// dd-Mmm-yy, matching TILE-DISPLAY-STANDARDS' default date format.
function formatDate(iso) {
    if (typeof iso !== 'string' || !iso)
        return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        return '—';
    const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = months[d.getUTCMonth()];
    const year = String(d.getUTCFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
}
const STATUS_COLORS = {
    active: { bg: '#dcfce7', fg: '#15803d' },
    invited: { bg: '#fef3c7', fg: '#b45309' },
    deactivated: { bg: '#fee2e2', fg: '#b91c1c' },
};
function statusPill(status) {
    const s = typeof status === 'string' ? status : '';
    const colors = STATUS_COLORS[s] ?? { bg: '#e5e7eb', fg: '#374151' };
    return `<span style="display:inline-block;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600;background:${colors.bg};color:${colors.fg};">${escapeHtml(titleCase(s || 'Unknown'))}</span>`;
}
// ── print_report ────────────────────────────────────────────────────
// Opens a new browser tab with a visually-styled sign-ups report for
// the selected date range -- summary cards (count + share of total per
// status) plus a full member table (name, email, status, role, joined,
// tags, access group) -- then triggers the browser's print dialog.
// There's no system "print" action, so this is plain browser JS.
//
// `shouldPrint` is a gate, not a real report field: the member table
// comes from `list_members`, whose result lands on the SAME state path
// the month-popup also fetches into, so this action is bound from a
// `watch` on that shared path (fires on every list_members call) rather
// than chained directly after it in one `on.click` array -- the fix for
// exactly the "same-array staleness" trap this plugin's widget already
// works around elsewhere (see myconnect-admin.json's default-community
// watch chain). `shouldPrint` is true only when the click actually came
// from the Print report button, so the month-popup's own list_members
// calls no-op here instead of popping an unwanted print window.
//
// Args: { shouldPrint, communityName?, fromDate, toDate, total,
//         completed, pending, declined, members? }
const print_report = {
    description: 'When shouldPrint is true, open a visually-styled printable sign-ups report (summary + full member list) for the selected date range, and trigger the browser print dialog. No-ops when shouldPrint is false.',
    schema: {
        type: 'object',
        properties: {
            shouldPrint: { type: 'boolean' },
            communityName: { type: 'string' },
            fromDate: { type: 'string' },
            toDate: { type: 'string' },
            total: { type: 'number' },
            completed: { type: 'number' },
            pending: { type: 'number' },
            declined: { type: 'number' },
            members: { type: 'array' },
        },
        required: ['shouldPrint', 'fromDate', 'toDate', 'total', 'completed', 'pending', 'declined'],
    },
    handler: (params) => {
        if (params.shouldPrint !== true)
            return;
        const total = Number(params.total) || 0;
        const completed = Number(params.completed) || 0;
        const pending = Number(params.pending) || 0;
        const declined = Number(params.declined) || 0;
        const communityName = typeof params.communityName === 'string' && params.communityName
            ? params.communityName
            : 'Community';
        const fromDate = String(params.fromDate ?? '');
        const toDate = String(params.toDate ?? '');
        const members = Array.isArray(params.members) ? params.members : [];
        const win = window.open('', '_blank');
        if (!win)
            return;
        const statCard = (label, n, accent) => `
      <div style="flex:1;min-width:120px;background:#fff;border:1px solid #e5e7eb;border-top:4px solid ${accent};border-radius:10px;padding:14px 16px;">
        <div style="font-size:11px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.03em;">${escapeHtml(label)}</div>
        <div style="font-size:24px;font-weight:700;color:#111827;margin-top:4px;">${n}<span style="font-size:14px;font-weight:600;color:#6b7280;"> (${sharePct(n, total)})</span></div>
      </div>`;
        const memberRows = members
            .map((m) => {
            const groups = Array.isArray(m.accessGroups)
                ? m.accessGroups.map((g) => g?.name).filter(Boolean).join(', ')
                : '';
            return `<tr>
          <td>${escapeHtml(m.displayName ?? '—')}</td>
          <td>${escapeHtml(m.email ?? '—')}</td>
          <td>${statusPill(m.status)}</td>
          <td>${escapeHtml(titleCase(String(m.role ?? '')) || '—')}</td>
          <td>${escapeHtml(formatDate(m.createdAt))}</td>
          <td>${escapeHtml(m.tagsText || '—')}</td>
          <td>${escapeHtml(groups || '—')}</td>
        </tr>`;
        })
            .join('');
        win.document.write(`<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Sign-ups report — ${escapeHtml(communityName)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Arial, sans-serif; color: #111827; margin: 0; background: #f3f4f6; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .banner { background: linear-gradient(135deg, #1d4ed8, #0ea5e9); color: #fff; padding: 28px 32px; }
  .banner h1 { margin: 0; font-size: 20px; }
  .banner p { margin: 4px 0 0; font-size: 13px; opacity: .9; }
  .content { padding: 24px 32px 40px; }
  .cards { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 28px; }
  table { border-collapse: collapse; width: 100%; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 1px 2px rgba(0,0,0,.06); }
  th, td { text-align: left; padding: 10px 14px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
  thead th { background: #eff6ff; color: #1d4ed8; font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: .03em; }
  tbody tr:nth-child(even) { background: #fafafa; }
  tbody tr:last-child td { border-bottom: none; }
  h2 { font-size: 14px; color: #374151; margin: 0 0 10px; }
  .meta { color: #6b7280; font-size: 12px; margin-top: 2px; }
  @media print { body { background: #fff; } }
</style>
</head>
<body>
  <div class="banner">
    <h1>${escapeHtml(communityName)} — sign-ups report</h1>
    <p>${escapeHtml(fromDate)} to ${escapeHtml(toDate)}</p>
  </div>
  <div class="content">
    <div class="cards">
      ${statCard('Total sign-ups', total, '#1d4ed8')}
      ${statCard('Completed joining', completed, '#16a34a')}
      ${statCard('Pending members', pending, '#d97706')}
      ${statCard('Declined / inactive', declined, '#dc2626')}
    </div>
    <h2>Members</h2>
    ${members.length
            ? `<table>
            <thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Role</th><th>Joined</th><th>Tags</th><th>Access group</th></tr></thead>
            <tbody>${memberRows}</tbody>
          </table>`
            : `<p class="meta">No members found in this range.</p>`}
  </div>
</body>
</html>`);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 250);
    },
};
const elements = {
    slug: 'myconnect-community-admin',
    functions: { today, is_after },
    actions: { print_report },
};
export default elements;
