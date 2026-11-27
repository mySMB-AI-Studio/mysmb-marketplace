// node build.mjs: builds plugins/client-report-analytics-agent/content/automations/<originKey>.json for the Client Reporting Agent's BAS readiness checks automation:
// one Python node = the verified port (bas_checks.py, 2,000/2,000 identical to the TS original) + a few lines of glue.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const HERE = dirname(fileURLToPath(import.meta.url));
import { createHash } from 'node:crypto';

const SLUG = 'client-report-analytics-agent';
const PKG = join(HERE, '..', '..', '..', 'plugins', 'client-report-analytics-agent');
const deterministicUuid = (name) => {
  const h = createHash('sha256').update(name).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const sortKeys = (v) => Array.isArray(v) ? v.map(sortKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v;
const withHash = (p) => { const { contentHash: _d, ...rest } = p; return sortKeys({ ...rest, contentHash: createHash('sha256').update(JSON.stringify(sortKeys(rest))).digest('hex') }); };

const module_ = readFileSync(join(HERE, 'bas_checks.py'), 'utf8').replace(/\r\n/g, '\n');
const glue = `

# ---- run: the automation's inputs come in params; Xero is read through the xero-api API connector ----
def _text(v):
    return str(v).strip() if v is not None else ""


_gst = _text(params.get("gst_registered")).lower()
_gst_registered = True if _gst in ("yes", "true", "1") else False if _gst in ("no", "false", "0") else None


def _invoke(tool, args):
    return api.connectors.invoke(server=XERO, tool=tool, args=args)


result = run_checks(_invoke, _text(params["xero_tenant_id"]), _text(params["period_start"]), _text(params["period_end"]),
                    _gst_registered, _text(params.get("changed_since")) or None)
findings_count = len(result["findings"])
summary = (f"{result['organisation']['name']} {result['period']['start']} to {result['period']['end']}: "
           f"{findings_count} finding(s), {len(result['clear'])} clear, {len(result['notRun'])} not run")
`;

const PARAMS = [
  { name: 'xero_tenant_id', type: 'str', control: 'text', label: 'Xero organisation id (tenantId from get_connected_tenants)', required: true },
  { name: 'period_start', type: 'str', control: 'text', label: 'First day of the BAS period (YYYY-MM-DD)', required: true },
  { name: 'period_end', type: 'str', control: 'text', label: 'Last day of the BAS period (YYYY-MM-DD)', required: true },
  { name: 'changed_since', type: 'str', control: 'text', label: 'When the previous BAS was prepared (YYYY-MM-DD); empty = the period start', required: false },
  { name: 'gst_registered', type: 'str', control: 'text', label: 'Registered for GST: yes, no, or empty to infer it from the GST basis', required: false },
];
const description =
  'Runs the BAS readiness checks for one client and one BAS period, reading Xero through the Xero API connector, and returns ' +
  'the findings, what came back clear, what could not run, the ABNs to check with ABR Lookup, and the limitations. Read-only: ' +
  'nothing in Xero is changed. The Client Reporting Agent runs it during a BAS readiness review.';
const name = 'Client Reporting Agent: BAS readiness checks';
const originKey = deterministicUuid(`automation:${SLUG}:bas-readiness-checks`);
const payload = withHash({
  kind: 'automation',
  originKey,
  name,
  description,
  level: 'org',
  declaredScopes: ['connectors:xero-api'],
  dependencies: [],
  tags: [],
  practiceRun: { intendedActions: [], version: 2 },
  flowIr: {
    irVersion: 1,
    name,
    description,
    params: PARAMS,
    triggers: [{ kind: 'manual' }],
    rootOrder: ['run_checks'],
    nodes: [{
      id: 'run_checks',
      kind: 'python',
      title: 'Run the BAS readiness checks',
      summary: 'Reads the period\'s invoices, bills, credit notes, bank transactions, payments, contacts and reports from Xero and runs every BAS readiness rule on them.',
      params: PARAMS.map((p) => ({ ...p, control: 'hidden', binding: `{{ params.${p.name} }}` })),
      code: module_ + glue,
      outputs: [
        { name: 'result', type: 'dict', description: 'The checks: organisation, period, read, findings, clear, notRun, alsoSeen, abnsToCheck, limitations, note' },
        { name: 'findings_count', type: 'int', description: 'How many findings came back' },
        { name: 'summary', type: 'str', description: 'One line: client, period, findings, clear, not run' },
      ],
    }],
  },
});
writeFileSync(`${PKG}/content/automations/${originKey}.json`, JSON.stringify(payload, null, 2) + '\n');
console.log(originKey);
