// Automation definitions for the bookkeeping kit. gen-ext.js turns each into a Flow IR content file.
// '@form:<key>' is replaced by that form's sourceId (the installer remaps it to the tenant's form id).

const hidden = (name, type, binding, label, required = false) => ({ name, type, control: 'hidden', label, required, binding });
const formPicker = (name, form, label) => ({ name, type: 'uuid', control: 'form-picker', label, required: true, value: `@form:${form}` });
const fixed = (name, type, value, label) => ({ name, type, control: 'hidden', label, required: true, value });
const out = (name, type, description) => ({ name, type, description });
const node = (id, title, summary, libs, params, outputs) => ({ id, kind: 'python', title, summary, libs, params, outputs });
const step = (id, name) => `{{ steps.${id}.outputs.${name} }}`;

export const FORMS = ['setup', 'client-settings', 'bill-review', 'client-bill-approval', 'invoice-review', 'invoice-send-review',
  'payroll-settings', 'payrun', 'payroll-review', 'client-payroll-approval'];

export const AUTOMATIONS = [
  {
    key: 'start-setup',
    neutral: true,
    name: 'Bookkeeping: Start setup',
    description:
      'Creates the WorkQ items that set up bookkeeping: the Bookkeeping setup form (first run only) and one Client bookkeeping settings form per business you list. Run it again any time to add businesses.',
    triggers: [{ kind: 'manual' }],
    params: [
      {
        name: 'client_names',
        type: 'str',
        control: 'text',
        label: 'Client businesses to set up (one per line)',
        description: 'Leave blank on the first run to create only the Bookkeeping setup item.',
        required: false,
        value: '',
      },
      {
        name: 'payroll_names',
        type: 'str',
        control: 'text',
        label: 'Client businesses to set up payroll for (one per line)',
        description: 'Each needs its bookkeeping settings first.',
        required: false,
        value: '',
      },
    ],
    scopes: ['workq:write', 'files:read'],
    forms: ['setup', 'client-settings', 'payroll-settings'],
    nodes: [
      node('start_setup', 'Create setup items', 'Creates the Bookkeeping setup item if bookkeeping is not set up yet, and one client settings item per business listed, each with its form attached.', ['util'],
        [
          formPicker('setup_form', 'setup', 'Bookkeeping setup form'),
          formPicker('client_form', 'client-settings', 'Client bookkeeping settings form'),
          formPicker('payroll_form', 'payroll-settings', 'Client payroll settings form'),
          hidden('client_names', 'str', '{{ params.client_names }}', 'Client names'),
          hidden('payroll_names', 'str', '{{ params.payroll_names }}', 'Payroll client names'),
          hidden('actor', 'str', '{{ trigger.actor_user_id }}', 'Person who ran it'),
        ],
        [out('created_count', 'int', 'How many setup items were created'), out('summary', 'str', 'What happened')]),
    ],
    rootOrder: ['start_setup'],
  },

  {
    key: 'apply-setup',
    name: 'Bookkeeping: Apply setup (Xero)',
    description:
      'When a Bookkeeping setup or Client bookkeeping settings form is submitted, saves the answers to Knowledge (Bookkeeping/settings.json and Bookkeeping/Clients/<client>.json), finds the client’s Xero organisation, and creates the client’s inbox folder.',
    triggers: [
      { kind: 'event', eventType: 'form.response_submitted', filter: { form_id: '@form:setup' } },
      { kind: 'event', eventType: 'form.response_submitted', filter: { form_id: '@form:client-settings' } },
      { kind: 'event', eventType: 'form.response_submitted', filter: { form_id: '@form:payroll-settings' } },
    ],
    params: [],
    scopes: ['workq:write', 'files:read', 'files:write', 'connectors:xero-accounting'],
    forms: ['setup', 'client-settings', 'payroll-settings'],
    nodes: [
      node('apply_setup', 'Save the settings', 'Saves the setup, client or payroll settings answers to Knowledge, matches the client to a Xero organisation, and comments on the setup item with the next steps.', ['util', 'xero', 'payroll'],
        [
          hidden('responses', 'dict', '{{ trigger.event.payload.responses }}', 'Form answers'),
          hidden('todo_id', 'str', '{{ trigger.event.subject.todo_id }}', 'Setup item'),
          hidden('form_id', 'str', '{{ trigger.event.subject.form_id }}', 'Submitted form', true),
          hidden('actor', 'str', '{{ trigger.actor_user_id }}', 'Person who submitted it'),
          formPicker('setup_form', 'setup', 'Bookkeeping setup form'),
          formPicker('client_form', 'client-settings', 'Client bookkeeping settings form'),
          formPicker('payroll_form', 'payroll-settings', 'Client payroll settings form'),
        ],
        [out('outcome', 'str', 'settings_saved, client_saved, payroll_saved, xero_org_not_found or ignored')]),
    ],
    rootOrder: ['apply_setup'],
  },

  {
    key: 'process-bill',
    name: 'Bookkeeping: Process bill, invoice or statement (Xero)',
    description:
      'When a PDF or a photo of one lands in Bookkeeping Inbox/<client> in Knowledge (or in Bookkeeping Inbox itself, when AI can tell which client it’s for), reads it (a scan or photo is read by AI from the image) and works out whether it is a supplier bill (addressed to the client), a sales invoice (issued by the client) or a statement. A bank or credit card statement is attached to its bank account in Xero and its closing balance compared with Xero’s; a statement of account is attached to the supplier or customer and compared with what Xero shows open; only differences reach WorkQ. A bill or invoice is checked, codes it (saved rule, then the contact’s history in Xero, then AI), creates a draft bill or sales invoice with the PDF attached in the client’s own Xero organisation, and sends it to the reviewer in WorkQ. Anything it can’t handle becomes an exception item.',
    triggers: [
      { kind: 'event', eventType: 'knowledge.file_created', filter: { scope: 'org' } },
      { kind: 'manual' },
    ],
    params: [
      {
        name: 'file_path',
        type: 'str',
        control: 'text',
        label: 'Knowledge file to process (manual re-runs only)',
        description: 'For example Bookkeeping Inbox/acme-plumbing/INV-1001.pdf',
        required: false,
        value: '',
      },
    ],
    scopes: ['files:read', 'files:write', 'workq:write', 'ai:generate', 'connectors:xero-accounting'],
    forms: ['bill-review', 'invoice-review'],
    nodes: [
      node('resolve_file', 'Is this a bill or invoice?', 'Checks the new file is a PDF or a photo (JPG or PNG, which becomes a one-page PDF) in Bookkeeping Inbox. One dropped into Bookkeeping Inbox itself instead of a client’s folder is matched to its client by AI; if that isn’t clear it moves to Bookkeeping Failed/unmatched with a WorkQ item.', ['util'],
        [hidden('path', 'str', '{{ trigger.event.subject.path ?? params.file_path }}', 'File path')],
        [out('should_process', 'bool', 'True for a PDF in a client inbox folder, or one in the inbox itself that was matched to a client'), out('path', 'str', 'Knowledge path'),
          out('client_folder', 'str', 'Client folder name (the matched client, for a file in the inbox itself)'), out('file_name', 'str', 'File name'), out('skip_reason', 'str', 'Why it was skipped')]),
      { id: 'gate', kind: 'if', title: 'Only PDFs for a client', summary: 'Continues only for PDFs in a client inbox folder, or matched to a client.',
        cond: 'steps["resolve_file"]["outputs"]["should_process"]',
        then: ['load_context', 'read_invoice', 'which_kind'], else: [] },
      node('load_context', 'Load settings', 'Loads the bookkeeping settings, the client’s settings and its coding rules.', ['util'],
        [hidden('folder', 'str', step('resolve_file', 'client_folder'), 'Client folder', true)],
        [out('ctx', 'dict', 'Settings, client and rules'), out('problem', 'str', 'Why processing stopped, or empty')]),
      node('read_invoice', 'Read the document', 'Extracts the PDF text and has AI read it (a scan or a photo, which has no text, is read from the image): an invoice’s supplier, dates, lines, GST and total, or a statement’s account, period, balances, listed invoices and transactions.', ['util'],
        [hidden('path', 'str', step('resolve_file', 'path'), 'File path', true), hidden('problem', 'str', step('load_context', 'problem'), 'Problem so far')],
        [out('invoice', 'dict', 'What the invoice says'), out('statement', 'dict', 'What the statement says, when it is one'),
          out('problem', 'str', 'Why processing stopped, or empty')]),
      { id: 'which_kind', kind: 'if', title: 'Statement or invoice?', summary: 'Statements are filed in Xero; bills and invoices are checked, coded and reviewed.',
        cond: 'steps["read_invoice"]["outputs"]["statement"]', then: ['file_statement'], else: ['check_and_code', 'post_draft', 'route_review'] },
      node('file_statement', 'File the statement in Xero', 'Matches the bank account (by number or name) or the supplier or customer and attaches the PDF to it in Xero. A bank statement whose lines aren’t in Xero yet becomes a CSV for Xero’s statement import, with a WorkQ item to upload it; a statement of account is compared with what Xero shows open.', ['util', 'xero'],
        [hidden('ctx', 'dict', step('load_context', 'ctx'), 'Context', true), hidden('statement', 'dict', step('read_invoice', 'statement'), 'Statement', true),
          hidden('path', 'str', step('resolve_file', 'path'), 'File path', true)],
        [out('outcome', 'str', 'filed, ready_to_import, filed_with_issues or exception'), out('todo_id', 'str', 'The WorkQ item, when one was needed'),
          out('csv_path', 'str', 'The CSV for Xero’s statement import, when one was made')]),
      node('check_and_code', 'Check and code', 'Works out whether it is a bill or a sales invoice, finds the supplier or customer in Xero, checks totals, GST, ABN and duplicates, and codes each line from a saved rule, the contact’s history, or AI.', ['util', 'xero'],
        [hidden('ctx', 'dict', step('load_context', 'ctx'), 'Context', true), hidden('invoice', 'dict', step('read_invoice', 'invoice'), 'Invoice'),
          hidden('problem', 'str', step('read_invoice', 'problem'), 'Problem so far')],
        [out('proposal', 'dict', 'The bill to post'), out('warnings', 'list[str]', 'Things to check'), out('blocking', 'list[str]', 'Things to fix before approving'),
          out('confidence', 'str', 'high, medium or low'), out('problem', 'str', 'Why processing stopped, or empty')]),
      node('post_draft', 'Create the draft in Xero', 'Creates a DRAFT bill or sales invoice in the client’s Xero organisation and attaches the PDF (new suppliers and customers wait for approval).', ['util', 'xero'],
        [hidden('ctx', 'dict', step('load_context', 'ctx'), 'Context', true), hidden('proposal', 'dict', step('check_and_code', 'proposal'), 'Bill'),
          hidden('blocking', 'list[str]', step('check_and_code', 'blocking'), 'Blocking issues'), hidden('problem', 'str', step('check_and_code', 'problem'), 'Problem so far'),
          hidden('path', 'str', step('resolve_file', 'path'), 'File path', true)],
        [out('bill_id', 'str', 'Xero InvoiceID of the draft, or empty'), out('attach_error', 'str', 'Why the PDF could not be attached, or empty'),
          out('problem', 'str', 'Why processing stopped, or empty')]),
      node('route_review', 'Send for review', 'Creates the review item with the Bill review or Invoice review form (or skips review for small, confident bills when allowed), or an exception item if something went wrong. Moves the PDF out of the inbox.', ['util', 'xero'],
        [hidden('problem', 'str', step('post_draft', 'problem'), 'Problem so far'), hidden('ctx', 'dict', step('load_context', 'ctx'), 'Context', true),
          hidden('proposal', 'dict', step('check_and_code', 'proposal'), 'Bill'), hidden('warnings', 'list[str]', step('check_and_code', 'warnings'), 'Warnings'),
          hidden('blocking', 'list[str]', step('check_and_code', 'blocking'), 'Blocking issues'), hidden('confidence', 'str', step('check_and_code', 'confidence'), 'Confidence'),
          hidden('bill_id', 'str', step('post_draft', 'bill_id'), 'Draft bill'), hidden('attach_error', 'str', step('post_draft', 'attach_error'), 'Attachment error'),
          hidden('path', 'str', step('resolve_file', 'path'), 'File path', true), formPicker('review_form', 'bill-review', 'Bill review form'),
          formPicker('invoice_form', 'invoice-review', 'Invoice review form')],
        [out('outcome', 'str', 'review, auto_approved or exception'), out('todo_id', 'str', 'The WorkQ item created')]),
    ],
    rootOrder: ['resolve_file', 'gate'],
  },

  {
    key: 'apply-review',
    name: 'Bookkeeping: Apply bill or invoice review (Xero)',
    description:
      'When a Bill review, Invoice review, Invoice to send or Client bill approval form is submitted, applies the decision in the client’s Xero organisation: approve (with any changes), reject, or ask the client. Approved sales invoices go to Awaiting payment; Xero emails a raised invoice to the customer only when the reviewer says so. Bills over the client-approval limit get a follow-up item with a draft email. Coding changes are remembered for the supplier or customer.',
    triggers: [
      { kind: 'event', eventType: 'form.response_submitted', filter: { form_id: '@form:bill-review' } },
      { kind: 'event', eventType: 'form.response_submitted', filter: { form_id: '@form:invoice-review' } },
      { kind: 'event', eventType: 'form.response_submitted', filter: { form_id: '@form:invoice-send-review' } },
      { kind: 'event', eventType: 'form.response_submitted', filter: { form_id: '@form:client-bill-approval' } },
    ],
    params: [],
    scopes: ['files:read', 'files:write', 'workq:write', 'ai:generate', 'connectors:xero-accounting'],
    forms: ['bill-review', 'client-bill-approval', 'invoice-review', 'invoice-send-review'],
    nodes: [
      node('load_review', 'Load the bill', 'Loads the bill record for the item and reads the decision from the form.', ['util'],
        [
          hidden('todo_id', 'str', '{{ trigger.event.subject.todo_id }}', 'Review item'),
          hidden('form_id', 'str', '{{ trigger.event.subject.form_id }}', 'Submitted form', true),
          hidden('responses', 'dict', '{{ trigger.event.payload.responses }}', 'Form answers'),
          hidden('actor', 'str', '{{ trigger.actor_user_id }}', 'Reviewer'),
          formPicker('review_form', 'bill-review', 'Bill review form'),
          formPicker('approval_form', 'client-bill-approval', 'Client bill approval form'),
          formPicker('invoice_form', 'invoice-review', 'Invoice review form'),
          formPicker('send_form', 'invoice-send-review', 'Invoice to send form'),
        ],
        [out('ctx', 'dict', 'Settings, client and bill record'), out('decision', 'dict', 'What the reviewer decided'), out('problem', 'str', 'Why nothing will be applied, or empty')]),
      node('apply_decision', 'Apply the decision in Xero', 'Applies changes, then approves, deletes, or creates the follow-up item for the client, in the client’s Xero organisation.', ['util', 'xero'],
        [
          hidden('problem', 'str', step('load_review', 'problem'), 'Problem so far'),
          hidden('ctx', 'dict', step('load_review', 'ctx'), 'Context', true),
          hidden('decision', 'dict', step('load_review', 'decision'), 'Decision', true),
          formPicker('review_form', 'bill-review', 'Bill review form'),
          formPicker('approval_form', 'client-bill-approval', 'Client bill approval form'),
          formPicker('invoice_form', 'invoice-review', 'Invoice review form'),
          formPicker('send_form', 'invoice-send-review', 'Invoice to send form'),
        ],
        [out('outcome', 'str', 'approved, rejected, client_approval_requested or question_drafted'), out('followup_id', 'str', 'Follow-up item, if any'),
          out('changed_coding', 'bool', 'True when the reviewer changed an account or tax code'), out('record', 'dict', 'The updated bill record'),
          out('problem', 'str', 'Why it failed, or empty')]),
      node('close_review', 'Learn and close', 'Remembers the coding for the supplier when asked, comments on the item with the result, and completes it.', ['util', 'xero'],
        [
          hidden('problem', 'str', step('apply_decision', 'problem'), 'Problem'),
          hidden('ctx', 'dict', step('load_review', 'ctx'), 'Context', true),
          hidden('decision', 'dict', step('load_review', 'decision'), 'Decision', true),
          hidden('record', 'dict', step('apply_decision', 'record'), 'Bill record'),
          hidden('outcome', 'str', step('apply_decision', 'outcome'), 'Outcome'),
          hidden('changed_coding', 'bool', step('apply_decision', 'changed_coding'), 'Coding changed'),
          hidden('todo_id', 'str', '{{ trigger.event.subject.todo_id }}', 'Item'),
        ],
        [out('learned', 'str', 'Supplier whose coding was remembered, or empty')]),
    ],
    rootOrder: ['load_review', 'apply_decision', 'close_review'],
  },


  {
    key: 'draft-invoice',
    name: 'Bookkeeping: Draft requested invoice (Xero)',
    description:
      'When a client asks for an invoice to be raised (an email that Email intake files in Bookkeeping Requests/<client>, ' +
      'or run by hand with the request text), drafts the sales invoice in the client’s Xero organisation: the customer, ' +
      'the lines priced from Xero items or what the request says, and the coding. The reviewer approves it in WorkQ and ' +
      'chooses whether Xero emails it to the customer.',
    triggers: [
      { kind: 'event', eventType: 'knowledge.file_created', filter: { scope: 'org' } },
      { kind: 'manual' },
    ],
    params: [
      { name: 'client_name', type: 'str', control: 'text', label: 'Client business (manual runs only)', required: false, value: '',
        description: 'The business asking for the invoice, as in its client settings.' },
      { name: 'request_text', type: 'str', control: 'text', label: 'What to invoice (manual runs only)', required: false, value: '',
        description: 'For example: Please invoice Bayview Hospitality for 6 hours of plumbing labour in September.' },
    ],
    scopes: ['files:read', 'files:write', 'workq:write', 'ai:generate', 'connectors:xero-accounting'],
    forms: ['invoice-send-review'],
    nodes: [
      node('load_request', 'Is this an invoice request?', 'Reads the request filed by Email intake, or the one typed in, and loads the client’s settings.', ['util'],
        [hidden('path', 'str', '{{ trigger.event.subject.path }}', 'Request file'),
          hidden('client_name', 'str', '{{ params.client_name }}', 'Client'), hidden('request_text', 'str', '{{ params.request_text }}', 'Request')],
        [out('should_process', 'bool', 'True for a request to draft'), out('request', 'dict', 'The request'),
          out('ctx', 'dict', 'Settings, client and rules'), out('problem', 'str', 'Why it stopped, or empty'), out('skip_reason', 'str', 'Why it was skipped')]),
      { id: 'gate', kind: 'if', title: 'Only invoice requests', summary: 'Continues only for a request filed in Bookkeeping Requests, or one typed in.',
        cond: 'steps["load_request"]["outputs"]["should_process"]',
        then: ['draft_invoice', 'route_request'], else: [] },
      node('draft_invoice', 'Draft the invoice', 'Has AI read the customer and lines from the request, prices them from Xero items or the request, codes them, and creates a draft in Xero for an existing customer.', ['util', 'xero'],
        [hidden('ctx', 'dict', step('load_request', 'ctx'), 'Context', true), hidden('request', 'dict', step('load_request', 'request'), 'Request', true),
          hidden('problem', 'str', step('load_request', 'problem'), 'Problem so far')],
        [out('proposal', 'dict', 'The invoice to raise'), out('warnings', 'list[str]', 'Things to check'), out('blocking', 'list[str]', 'Things to fix before approving'),
          out('bill_id', 'str', 'Xero InvoiceID of the draft, or empty'), out('problem', 'str', 'Why it stopped, or empty')]),
      node('route_request', 'Send for approval', 'Creates the WorkQ item with the Invoice to send form, or an exception item if something went wrong. Files the request away.', ['util', 'xero'],
        [hidden('problem', 'str', step('draft_invoice', 'problem'), 'Problem so far'), hidden('ctx', 'dict', step('load_request', 'ctx'), 'Context', true),
          hidden('request', 'dict', step('load_request', 'request'), 'Request', true), hidden('proposal', 'dict', step('draft_invoice', 'proposal'), 'Invoice'),
          hidden('warnings', 'list[str]', step('draft_invoice', 'warnings'), 'Warnings'), hidden('blocking', 'list[str]', step('draft_invoice', 'blocking'), 'Blocking issues'),
          hidden('bill_id', 'str', step('draft_invoice', 'bill_id'), 'Draft invoice'), formPicker('send_form', 'invoice-send-review', 'Invoice to send form')],
        [out('outcome', 'str', 'review or exception'), out('todo_id', 'str', 'The WorkQ item created')]),
    ],
    rootOrder: ['load_request', 'gate'],
  },
  {
    key: 'ap-digest',
    name: 'Bookkeeping: Weekly AP digest (Xero)',
    description:
      'Every Monday morning, summarises each client’s bills from Xero (drafts, awaiting approval, due in the next 14 days, overdue) and the open review and exception items, saves it as an HTML artifact, and notifies the digest recipients.',
    triggers: [{ kind: 'schedule', cron: '0 8 * * 1', timezone: 'Australia/Sydney' }, { kind: 'manual' }],
    params: [],
    scopes: ['files:read', 'workq:read', 'ai:generate', 'artifacts:write', 'notify:send', 'connectors:xero-accounting'],
    forms: [],
    nodes: [
      node('gather_ap', 'Gather bills', 'Reads each client’s open bills from Xero and counts the open bookkeeping items.', ['util', 'xero'], [],
        [out('summary', 'dict', 'Per-client counts and amounts'), out('problem', 'str', 'Why the digest was skipped, or empty')]),
      node('publish_digest', 'Publish the digest', 'Writes a short commentary, saves the digest as an HTML artifact and notifies the recipients.', ['util'],
        [hidden('summary', 'dict', step('gather_ap', 'summary'), 'Summary', true), hidden('problem', 'str', step('gather_ap', 'problem'), 'Problem')],
        [out('artifact_url', 'str', 'Link to the digest')]),
    ],
    rootOrder: ['gather_ap', 'publish_digest'],
  },


  // ── Payroll (phase 1: check and prepare; nothing is written to Xero Payroll) ──
  {
    key: 'payroll-start',
    name: 'Bookkeeping: Start pay runs (Xero Payroll)',
    description:
      'Every hour on weekdays, for each client with payroll settings: on the preparation day of its pay calendar, opens the ' +
      'pay run item with the checklist and the Pay run form; says when the period’s timesheets are in Xero Payroll; and, if ' +
      'Deputy timesheets are late, drafts a chase email for the payroll officer to send.',
    triggers: [{ kind: 'schedule', cron: '0 7-17 * * 1-5', timezone: 'Australia/Sydney' }, { kind: 'manual' }],
    params: [
      { name: 'client_name', type: 'str', control: 'text', label: 'Client business (manual runs only: opens its pay run now)', required: false, value: '' },
    ],
    scopes: ['files:read', 'files:write', 'workq:write', 'ai:generate', 'connectors:xero-payroll-au'],
    forms: ['payrun'],
    nodes: [
      node('start_runs', 'Open pay runs and watch for timesheets', 'Opens each client’s pay run item on its preparation day, notes when timesheets are in Xero Payroll and drafts a chase when they’re late.', ['util', 'payroll'],
        [hidden('client_name', 'str', '{{ params.client_name }}', 'Client'), hidden('now', 'str', '{{ trigger.now }}', 'Run time'),
          formPicker('payrun_form', 'payrun', 'Pay run form')],
        [out('summary', 'str', 'What happened')]),
    ],
    rootOrder: ['start_runs'],
  },
  ...[['deputy', 'Xero Payroll + Deputy', ['connectors:xero-payroll-au', 'connectors:deputy']], ['xero', 'Xero Payroll', ['connectors:xero-payroll-au']]].map(
    ([provider, label, connectors]) => ({
      key: `payroll-check-${provider}`,
      codeKey: 'payroll-check',
      name: `Bookkeeping: Check pay run (${label})`,
      description:
        'When the payroll officer chooses Run the checks on a pay run item (or run by hand with the client’s name): compares ' +
        (provider === 'deputy' ? 'Deputy hours with Xero Payroll per employee per day, ' : 'the timesheets in Xero Payroll, ') +
        'lists missing starters and salaried staff with timesheets, splits each casual’s shifts into penalty bands and checks ' +
        'the rates against the client’s pay guide, lists this period’s changes (junior birthdays, arrangements ending, 1 July) ' +
        'and reimbursement differences, then posts a report and one drafted query email. Reads only. Publish one version.',
      triggers: [
        { kind: 'event', eventType: 'form.response_submitted', filter: { form_id: '@form:payrun' } },
        { kind: 'manual' },
      ],
      params: [
        { name: 'client_name', type: 'str', control: 'text', label: 'Client business (manual runs only)', required: false, value: '' },
      ],
      scopes: ['files:read', 'files:write', 'workq:write', 'ai:generate', 'artifacts:write', ...connectors],
      forms: ['payrun'],
      nodes: [
        node('load_run', 'Find the pay run', 'Finds the pay run for the item (or the client’s open one), records the officer’s notes, and handles Cancel.', ['util', 'payroll'],
          [hidden('todo_id', 'str', '{{ trigger.event.subject.todo_id }}', 'Pay run item'),
            hidden('responses', 'dict', '{{ trigger.event.payload.responses }}', 'Form answers'),
            hidden('client_name', 'str', '{{ params.client_name }}', 'Client'), hidden('actor', 'str', '{{ trigger.actor_user_id }}', 'Person')],
          [out('should_check', 'bool', 'True when the checks should run'), out('ctx', 'dict', 'Settings, client, payroll settings and pay run'),
            out('problem', 'str', 'Why the checks won’t run, or empty')]),
        { id: 'gate', kind: 'if', title: 'Only when asked', summary: 'Continues only for Run the checks.',
          cond: 'steps["load_run"]["outputs"]["should_check"]', then: ['check', 'report'], else: [] },
        node('check', 'Check the pay run', 'Reads the pay calendar’s employees, timesheets, pay items and draft pay run from Xero Payroll' + (provider === 'deputy' ? ', the period’s Deputy timesheets,' : '') + ' the pay guide and the reimbursement file, and works out what to fix.', ['util', 'payroll'],
          [fixed('provider', 'str', provider, 'Timesheet source'), hidden('ctx', 'dict', step('load_run', 'ctx'), 'Context', true),
            hidden('problem', 'str', step('load_run', 'problem'), 'Problem so far')],
          [out('findings', 'dict', 'What the check found'), out('problem', 'str', 'Why the check stopped, or empty')]),
        node('report', 'Report and draft queries', 'Saves the check as an HTML report, comments a summary on the pay run item, and drafts one query email to the client.', ['util', 'payroll'],
          [hidden('ctx', 'dict', step('load_run', 'ctx'), 'Context', true), hidden('findings', 'dict', step('check', 'findings'), 'Findings'),
            hidden('problem', 'str', step('check', 'problem'), 'Problem so far')],
          [out('open_items', 'int', 'Things to fix or confirm'), out('report_url', 'str', 'The check report')]),
      ],
      rootOrder: ['load_run', 'gate'],
    })),
  {
    key: 'payroll-pack',
    name: 'Bookkeeping: Build payroll review pack (Xero Payroll)',
    description:
      'When the payroll officer chooses Ready for review on a pay run item: reads the draft pay run from Xero Payroll and builds ' +
      'the review pack (totals, each employee’s pay, the last check, this period’s changes and notes), then sends it to the ' +
      'internal reviewer as a WorkQ item with the Payroll review form.',
    triggers: [
      { kind: 'event', eventType: 'form.response_submitted', filter: { form_id: '@form:payrun' } },
      { kind: 'manual' },
    ],
    params: [
      { name: 'client_name', type: 'str', control: 'text', label: 'Client business (manual runs only)', required: false, value: '' },
    ],
    scopes: ['files:read', 'files:write', 'workq:write', 'artifacts:write', 'connectors:xero-payroll-au'],
    forms: ['payrun', 'payroll-review'],
    nodes: [
      node('build_pack', 'Build the review pack', 'Builds the review pack from the draft pay run and sends it to the internal reviewer.', ['util', 'payroll'],
        [hidden('todo_id', 'str', '{{ trigger.event.subject.todo_id }}', 'Pay run item'),
          hidden('responses', 'dict', '{{ trigger.event.payload.responses }}', 'Form answers'),
          hidden('client_name', 'str', '{{ params.client_name }}', 'Client'), hidden('actor', 'str', '{{ trigger.actor_user_id }}', 'Person'),
          formPicker('review_form', 'payroll-review', 'Payroll review form')],
        [out('outcome', 'str', 'in_review, no_draft, no_pay_run or ignored'), out('pack_url', 'str', 'The review pack')]),
    ],
    rootOrder: ['build_pack'],
  },
  {
    key: 'payroll-review',
    name: 'Bookkeeping: Apply payroll review',
    description:
      'When the Payroll review or Client payroll approval form is submitted: an approved internal review creates the client ' +
      'approval item with a drafted email; changes go back to the payroll officer; the client’s approval completes the pay run ' +
      '(or asks the practice to post it, per the settings).',
    triggers: [
      { kind: 'event', eventType: 'form.response_submitted', filter: { form_id: '@form:payroll-review' } },
      { kind: 'event', eventType: 'form.response_submitted', filter: { form_id: '@form:client-payroll-approval' } },
    ],
    params: [],
    scopes: ['files:read', 'files:write', 'workq:write', 'ai:generate'],
    forms: ['payroll-review', 'client-payroll-approval'],
    nodes: [
      node('apply_payroll_review', 'Apply the review', 'Moves the pay run to client approval, back to the officer, or to done.', ['util', 'payroll'],
        [hidden('todo_id', 'str', '{{ trigger.event.subject.todo_id }}', 'Review item'),
          hidden('form_id', 'str', '{{ trigger.event.subject.form_id }}', 'Submitted form', true),
          hidden('responses', 'dict', '{{ trigger.event.payload.responses }}', 'Form answers'),
          hidden('actor', 'str', '{{ trigger.actor_user_id }}', 'Person'),
          formPicker('review_form', 'payroll-review', 'Payroll review form'),
          formPicker('client_form', 'client-payroll-approval', 'Client payroll approval form')],
        [out('outcome', 'str', 'What happened')]),
    ],
    rootOrder: ['apply_payroll_review'],
  },
  // Email intake: one automation per mailbox kind, so each only needs its own connector connected to publish.
  ...[['outlook', 'Outlook', 'm365-mail-read', 'Microsoft 365'], ['gmail', 'Gmail', 'google-workspace-gmail', 'Google Workspace']].map(
    ([provider, label, server, extension]) => ({
      key: `email-intake-${provider}`,
      codeKey: 'email-intake',
      neutral: true,
      name: `Bookkeeping: Email intake (${label})`,
      description:
        `Every 15 minutes, checks the owner’s ${label} inbox for emails with a PDF attached, has AI pick out supplier bills ` +
        'and the clients’ own sales invoices, works out which client each one belongs to, and files it in that client’s Bookkeeping Inbox folder, ' +
        'where Process bill takes over. Other emails are left untouched. Needs the ' + extension + ' extension, with ' +
        label + ' connected by the automation’s owner.',
      triggers: [{ kind: 'schedule', cron: '*/15 * * * *', timezone: 'Australia/Sydney' }, { kind: 'manual' }],
      params: [],
      scopes: ['files:read', 'files:write', 'workq:write', 'ai:generate', `connectors:${server}`],
      forms: [],
      nodes: [
        node('find_emails', 'Find new emails', `Lists the newest ${label} inbox emails with attachments that haven’t been looked at yet.`, ['util', 'mail'],
          [fixed('provider', 'str', provider, 'Mailbox')],
          [out('candidates', 'list[dict]', 'New emails with attachments'), out('since', 'str', 'When email intake started'),
            out('problem', 'str', 'Why nothing was checked, or empty')]),
        node('triage_emails', 'Pick out the bills', 'Has AI decide which emails are supplier bills or sales invoices (with a PDF, or a photo when there is no PDF) or requests to raise an invoice; everything else is left alone.', ['util', 'mail'],
          [fixed('provider', 'str', provider, 'Mailbox'), hidden('candidates', 'list[dict]', step('find_emails', 'candidates'), 'New emails'),
            hidden('problem', 'str', step('find_emails', 'problem'), 'Problem so far')],
          [out('bills', 'list[dict]', 'Emails carrying a supplier bill or sales invoice'), out('requests', 'list[dict]', 'Emails asking for an invoice to be raised'),
            out('skipped', 'list[dict]', 'Emails left alone, and why')]),
        node('file_bills', 'File each one under its client', 'Saves each bill or invoice PDF (or photo) into its client’s Bookkeeping Inbox folder (which starts Process bill or invoice) and each invoice request into Bookkeeping Requests (which starts Draft requested invoice). Anything it can’t place becomes an exception item.', ['util', 'mail'],
          [fixed('provider', 'str', provider, 'Mailbox'), hidden('bills', 'list[dict]', step('triage_emails', 'bills'), 'Bills'),
            hidden('requests', 'list[dict]', step('triage_emails', 'requests'), 'Invoice requests'),
            hidden('skipped', 'list[dict]', step('triage_emails', 'skipped'), 'Left alone'),
            hidden('since', 'str', step('find_emails', 'since'), 'Intake start'), hidden('problem', 'str', step('find_emails', 'problem'), 'Problem so far')],
          [out('filed', 'int', 'Bills and invoices filed under a client'), out('requested', 'int', 'Invoice requests filed under a client'),
            out('unmatched', 'int', 'Emails that need a client'), out('summary', 'str', 'What happened')]),
      ],
      rootOrder: ['find_emails', 'triage_emails', 'file_bills'],
    })),
];
