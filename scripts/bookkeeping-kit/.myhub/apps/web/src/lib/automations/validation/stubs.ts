/**
 * Type-stub generation — stage 3 inputs (architecture/technical/automations.md §10).
 *
 * Produces a temp pyright project per validation:
 *   _automation_env.pyi — the typed `api` surface, entity aliases, and the
 *                         TriggerCtx assembled from the flow's event triggers
 *                         (subject fields typed from EVENT_CATALOG — the
 *                         `assigned_to`-UUID class of bug dies here);
 *   node_<id>.py        — one file per python node: typed `params` TypedDict
 *                         (bindings typed from upstream output declarations),
 *                         the node code verbatim, then one typed assignment
 *                         per declared output so output-type lies also fail.
 *
 * The API signatures below are the single hand-maintained mirror of the
 * bridge registry — pipeline.test.ts asserts the two surfaces never drift.
 */

import { getEventEntry, type EventFieldDef } from '../../../../../../packages/shared/src/events/catalog.ts';
import type { FlowIr, FlowNode, ParamDef, OutputDef } from '../../../../../../packages/shared/src/automations/ir-schema.ts';
import { parseBinding, stepRefsOf, isBindingString } from '../../../../../../packages/shared/src/automations/bindings.ts';

/** Mini type language → Python type expression. Unknown names fall to Any. */
export function pyType(t: string): string {
  const trimmed = t.trim();
  const listMatch = /^list\[(.+)\]$/.exec(trimmed);
  if (listMatch) return `list[${pyType(listMatch[1]!)}]`;
  switch (trimmed) {
    case 'str':
    case 'uuid':
    case 'date':
    case 'datetime':
    case 'FileHandle':
      return 'str';
    case 'int':
      return 'int';
    case 'float':
      return 'float';
    case 'bool':
      return 'bool';
    case 'dict':
      return 'dict[str, Any]';
    default:
      // Entity aliases (PortalReport, Todo, …) are dict aliases in the env
      // stub; anything uncatalogued degrades to Any rather than blocking.
      return ENTITY_ALIASES.includes(trimmed) ? trimmed : 'Any';
  }
}

const ENTITY_ALIASES = [
  'Todo', 'Form', 'FormResponse', 'Template', 'PortalReport', 'ReportEvent',
  'User', 'Group', 'Client', 'Contact', 'Portal', 'SnapshotRow', 'KnowledgeFile',
];

/**
 * ns.method → one-line description rendered as a comment above each stub
 * signature. This is the AI generator's primary knowledge of what each
 * endpoint DOES (the signature alone says only what it takes) — keep the
 * semantics precise: what is created/returned, which ids to pass, and the
 * side effects that matter for authoring (grants, pinning, visibility).
 * pipeline.test.ts asserts every registry method has a doc.
 */
export const API_METHOD_DOCS: Record<string, string> = {
  'extension.settings': 'Read this installed extension\'s completed nonsecret configuration for the automation owner. Returns a dict of declared variable keys. No arguments; credentials never appear here. Requires extension_setup:read.',
  'records.list': 'List custom records from a published table; returns {type, records, nextCursor}. Use exact type_slug and declare records:<type_slug>:read. Optional limit (1–200), cursor, stage, owner_user_ids, q, include_archived and portal_id. Portal scope is validated against the owner\'s access. Row fields are camelCase, custom values are in data.',
  'records.get': 'Fetch a custom record by UUID; returns {type, record, activity, related} or None. Requires records:<type_slug>:read and the owner\'s table permission. Optional portal_id restricts the record to that portal.',
  'records.aggregate': 'Aggregate visible custom records with spec {groupBy: "stage"|"owner"|{field:key}, measure:{kind:"count"}|{kind:"sum"|"weightedSum",field:key}, filters?:{stage,ownerUserId,open}}. Requires records:<type_slug>:read.',
  'records.create': 'Create a custom record via normal validation, audit and events. record is {title?, data:{fieldKey:value}, ...} using the table\'s fields. Returns a camelCase record. Requires records:<type_slug>:write AND the owner\'s create permission. Optional portal_id assigns the record to an authorized portal.',
  'records.update': 'Update a custom record by UUID using a partial record object; expected_updated_at optionally prevents overwriting concurrent edits. Requires records:<type_slug>:write AND the owner\'s update permission.',
  'records.delete': 'Delete a custom record by UUID via the normal Records service. Requires records:<type_slug>:write AND the owner\'s delete permission. Optional portal_id narrows the scope.',
  'records.upsert': 'Atomically create or update a custom record using key {field:key,value:string}. The key must be a unique text field defined by the table. Pass record {title?,data:{...}}; unchanged input produces no duplicate events. Returns the record. Requires records:<type_slug>:write and the owner\'s mutation permissions. Use this for connector synchronization; never use a list-then-create race.',
  'workq.create':
    'Create a WorkQ item. scope: "org" (everyone), "me" (creator+assignees only), "groups"/"users" (explicit visibility). assignee_ids are user uuids from api.users.list. due_date is "YYYY-MM-DD". description is MARKDOWN — it renders through the same rich-text editor the WorkQ item modal uses. Write 2-4 human sentences or a short bulleted list, e.g. "Reviewed the Q2 invoice for accuracy.\\n\\n- Flagged two line items for follow-up.\\n- Confirmed the total matches the PO." NEVER dump raw `key=value` pairs — status/priority/due_date/assignees already render as the item\'s own structured fields, so do not restate them in the prose. Returns the created Todo (id, title, status, …).',
  'workq.get': 'Fetch one WorkQ item by id (camelCase row fields: dueDate, assigneeIds, …). Returns None if it does not exist or is not visible.',
  'workq.list': 'List visible WorkQ items, optionally filtered by status ("not_started"/"in_progress"/"done"), scope, priority, or a title search string. Returned rows use camelCase fields: id, title, status, priority, dueDate ("YYYY-MM-DD" or None), assigneeIds, labels — NOT snake_case (arguments are snake_case, row fields are not).',
  'workq.update': 'Update fields on an existing item (title, description, status, priority, due_date, assignees, labels). description is MARKDOWN — same format and rules as workq.create (human sentences or bullets; never a key=value dump; never restate status/priority/due_date, which the item already tracks structurally). Only pass the fields to change.',
  'workq.set_status': 'Set an item\'s status: "not_started", "in_progress", "done", or "cancelled".',
  'workq.assign': 'Replace an item\'s assignees (user uuids) and/or assigned groups.',
  'workq.complete': 'Mark an item done (shorthand for set_status "done").',
  'workq.comment': 'Add a comment to an item. body is MARKDOWN (same rich-text surface as the description — write real sentences, never a key=value dump).',
  'workq.nudge':
    'Nudge an item\'s responsible people (assignees + assigned-group members, or the creator when the item is UNASSIGNED) with a reminder — a sticky pop-up, a WorkQ sidebar count, and a bump to the top of their list. Use to prod stalled/idle work (pairs with the "WorkQ item has no activity" trigger). IMPORTANT: the nudge is sent AS THIS AUTOMATION\'S OWNER, and a nudge never goes to its own sender — so this cannot remind the owner about their OWN work. On an item whose only assignee is the owner it returns nudged=false ("no_recipients"). It is for nudging OTHER people (a team\'s shared queue, someone else\'s assigned item), not for self-reminders — use notify.send for those. Throttled to one nudge per item per day; returns {"nudged": bool, "recipient_count"/"reason"}. nudged=false with a reason ("already_nudged_today", "completed", "no_recipients", "locked") is a normal no-op, not an error.',
  'workq.attach_form':
    'Attach an existing form (form_id from api.forms.list) to a WorkQ item so the assignee can fill it from the item. Pins the form version; if the item belongs to a client portal, the portal contact is granted fill access automatically.',
  'templates.list': 'List templates visible to this automation\'s owner. kind: "playbook" (Activity templates) or "form" (form templates).',
  'templates.get': 'Fetch one template with its body and placeholders. Returns None when it does not exist or is not visible.',
  'templates.materialize':
    'Apply a published Activity template: fills its placeholders from `variables` and creates real WorkQ items. variables is keyed by placeholder logicalName; each value is {"type": "text"|"date"|"select", "value": "..."} or {"type": "entity", "value": {"id": ..., "label": ...}} or {"type": "role", "value": {"kind": "user"|"group", "id": ..., "label": ...}}. Optional portal_id scopes every created item into that client portal. Returns {"itemCount": n, "itemIds": [...]}.',
  'forms.list': 'List forms. status filter: "draft", "published", "archived". Returns {"items": [...], "nextCursor": ...}.',
  'forms.get': 'Fetch one form with its schema and response counts.',
  'forms.list_responses': 'Submitted responses to a form, under the owner\'s form:view permission. Returns {items, nextCursor}; loop until nextCursor is null. Optional cursor (use the returned opaque string), limit (1–200, default 50). Items use camelCase id, formId, portalId, todoId, subjectRef, subjectKind, submittedAt, viaTask, formVersion and responses. Match shared-form reviews by todoId; subjectRef/subjectKind are explicit popup subjects, never inferred. No draft answers, respondent attribution or internal __bound values.',
  'forms.assign_to_portals': 'Grant client portals access to fill a form (portal ids from api.portals.list).',
  'forms.create_from_template':
    'Instantiate a FORM template (kind "form" in api.templates.list) into a real published form. values fills the template\'s placeholders (same shape as templates.materialize variables). Returns {"form_id": ...} — attach it to items with api.workq.attach_form.',
  'users.list': 'Every user in the workspace (id, email, name, role, is_external). Match people by email/name here — never invent ids.',
  'users.get': 'Fetch one workspace user by id (email, name, role).',
  'groups.list': 'Every group (id, name).',
  'groups.members': 'The user ids belonging to a group.',
  'clients.list': 'The tenant\'s clients (businesses/individuals), optionally filtered by a name search. Each has primaryContactId (a contact id, may be None).',
  'clients.get': 'Fetch one client by id, including its primaryContactId.',
  'clients.create': 'Create a client. fields: {"name": ..., "type": "business"|"individual", ...}.',
  'clients.update': 'Update client fields by id.',
  'contacts.list': 'The tenant\'s contacts (client-side people; firstName/lastName/email). Contacts are NOT users — match a contact to a workspace user by email via api.users.list.',
  'contacts.get': 'Fetch one contact by id (firstName, lastName, email).',
  'contacts.create': 'Create a contact (firstName, lastName, email fields).',
  'contacts.update': 'Update fields on an existing contact by id.',
  'employees.list': 'The workspace users assigned to a client (client_id from api.clients.list). Returns [{"user_id": ..., "client_id": ...}] — resolve names via api.users.list.',
  'portals.list': 'Active client portals: portalId, portalName, clientId, clientName. The bridge between a client and its portal-scoped items/files.',
  'portals.get': 'Fetch one client portal by id (name, clientId).',
  'files.list': 'List files/folders in this automation\'s filesystem (level-locked; org level may pass scope="client", scope_id=<portalId> for a client folder).',
  'files.read': 'Read a TEXT file\'s contents as a string.',
  'files.get': 'Fetch a BINARY file (docx/xlsx/pdf/images) into the run\'s scratch space — returns a local path for the doc libraries to open.',
  'files.put': 'Save a file: pass content (text) or scratch_file (a path produced in this run). Same level-locked scoping as files.list.',
  'files.delete': "Delete a file from this automation's filesystem (same scoping as files.list).",
  'artifacts.put':
    'Save a workspace ARTIFACT — a versioned deliverable the workspace lists, previews and can share (NOT a file in this automation\'s own folder). Pass content (utf-8 text: md/txt/csv/json/html/xml) OR scratch_file (a path produced in this run, e.g. a PDF fpdf wrote or a docx python-docx saved). file_name sets the name and therefore the type (for scratch_file it defaults to the scratch file\'s basename); title is required and is the human-facing name. Returns {"artifact_id", "title", "kind", "file_name", "size_bytes", "version", "url"}. Requires the artifacts:write scope.',
  'artifacts.get':
    'Fetch one artifact by artifact_id: its metadata (title, kind, mime_type, size_bytes, version, url) plus content — a str for TEXT artifacts (md/txt/csv/json/html/xml), or a local scratch path for BINARIES (pdf/docx/xlsx/pptx/images) landed from __scratch_in_b64.',
  'artifacts.list':
    'List the artifacts this automation\'s owner can see, newest first. Optional query (matches title/description), kinds (e.g. ["document"]), statuses, tags, limit (max 100). Rows carry artifact_id, title, kind, mime_type, size_bytes, version, status, url.',
  'artifacts.share':
    'Mint a public share link for one artifact: returns {"url", "link_id", "expires_at", "max_views"}. The url carries the raw token and is returned ONCE — only its hash is stored, so it can never be recovered from link_id later. expires_at is an ISO 8601 instant; max_views caps redemptions. Requires the artifacts:write scope AND the owner\'s artifacts:share permission.',
  'snapshots.query': 'Read synced portal data rows (canonical contract), filterable by portal_id, source system, and entity_type (e.g. "attendance"). Each row has payload (the data) + observed_at.',
  'snapshots.upsert':
    'Write portal data snapshots — the canonical rows the client-portal tiles render. Give portal_id, source (e.g. "sprout"), entity_type ("attendance" | "attendance_month" | "scorecard" | "leave_balance" | "leave_request" | "employee") and rows=[{external_id, payload, observed_at?}]. payload MUST match the entity_type contract (attendance: employee_name, clock_in_time, work_location, status[present|late|absent]; attendance_month: employee_name, month[YYYY-MM], days_present, days_late, days_absent, working_days, attendance_rate[0-100]; scorecard: employee_name, month[YYYY-MM], score[0-5|null], attendance_component[0-5], review_component[0-5|null], review_count; leave_balance: employee_name, month[YYYY-MM], pto_balance_ending, pto_used_month). external_id identifies the entity so re-runs update in place; use the employee external id for one current leave_balance rollup per employee. observed_at is required for attendance/attendance_month/scorecard/leave_request. Pass replace=True for a full sync (drops rows not in this batch). Requires the snapshots:write scope.',
  'portal_reports.get': 'One monthly report by id (status, events, gallery paths).',
  'portal_reports.list': 'All monthly reports, newest first.',
  'portal_reports.latest_published': 'The most recent PUBLISHED monthly report, or None if none published yet.',
  'portal_reports.metrics': 'Per-portal computed attendance metrics for a report (leaveTakenDays, officeDaysPct, attendancePct — may be None until snapshot data exists).',
  'portal_reports.read_image': 'Fetch a report gallery image into scratch — returns a local path for PIL/fpdf.',
  'notify.send': 'Send an in-app notification (title + optional body) to users and/or groups. Pass real ids; "notify me" means the automation owner\'s user id.',
  'connectors.invoke': 'Call a tool on a connected external system (MCP server). server AND tool must come verbatim from the CONNECTED CONNECTORS list in the prompt (args keys too — never invent any of them); requires the matching connectors:<slug> scope for each server used. Returns the tool\'s result (dict/list/str depending on the tool). Runs as the automation owner\'s connection.',
  'ai.generate':
    'Delegate ONE judgment task to AI (summarize, classify, rephrase, draft copy — anything a human would need to actually read and think about, NOT deterministic logic). prompt is the instruction; input is the data to work over (pass ALL needed context here — the model sees nothing else, no steps/trigger/params). Returns the raw output text as a plain Python str — assign it straight into a param or output. Never use this for math, date arithmetic, or string formatting; write plain Python for those. Never chain multiple api.ai calls when one well-written prompt can do the whole task. To read a PDF (scanned or not) or a photo (PNG/JPEG/GIF/WebP), pass scratch_file=<a path from api.files.get or api.files.scratch_path>: the model sees the file itself, so scans and photos with no text layer can be read. PDFs up to 10 MB and 20 pages, images up to 5 MB.',
  'ai.extract':
    'Delegate ONE judgment task to AI that returns STRUCTURED data instead of text: turning unstructured input into a dict/list matching a shape you describe. prompt is the instruction, input is the data to work over (all needed context — no other data reaches the model), schema_hint optionally describes the wanted shape in plain language or a JSON example. Returns a parsed dict or list — index it like any other Python value. Never use this for deterministic parsing (fixed formats, regex-extractable data); write plain Python for those. To read a PDF (scanned or not) or a photo (PNG/JPEG/GIF/WebP), pass scratch_file=<a path from api.files.get or api.files.scratch_path>: the model sees the file itself, so scans and photos with no text layer can be read. PDFs up to 10 MB and 20 pages, images up to 5 MB. With a file, input is optional.',
};

/** ns.method → python method signature (must mirror bridge/namespaces.ts). */
export const API_STUB_SIGNATURES: Record<string, string> = {
  'extension.settings': 'def settings(self) -> dict[str, Any]: ...',
  'records.list': 'def list(self, *, type_slug: str, portal_id: str | None = ..., limit: int = ..., cursor: str | None = ..., stage: list[str] | None = ..., owner_user_ids: list[str] | None = ..., q: str | None = ..., include_archived: bool = ...) -> dict[str, Any]: ...',
  'records.get': 'def get(self, *, type_slug: str, record_id: str, portal_id: str | None = ..., include_archived: bool = ...) -> dict[str, Any] | None: ...',
  'records.aggregate': 'def aggregate(self, *, type_slug: str, spec: dict[str, Any], portal_id: str | None = ...) -> dict[str, Any]: ...',
  'records.create': 'def create(self, *, type_slug: str, record: dict[str, Any], portal_id: str | None = ...) -> dict[str, Any]: ...',
  'records.update': 'def update(self, *, type_slug: str, record_id: str, record: dict[str, Any], portal_id: str | None = ..., expected_updated_at: str | None = ...) -> dict[str, Any]: ...',
  'records.delete': 'def delete(self, *, type_slug: str, record_id: str, portal_id: str | None = ...) -> dict[str, Any]: ...',
  'records.upsert': 'def upsert(self, *, type_slug: str, key: dict[str, Any], record: dict[str, Any], portal_id: str | None = ...) -> dict[str, Any]: ...',
  'workq.create':
    'def create(self, *, title: str, scope: str = ..., description: str | None = ..., priority: str = ..., due_date: str | None = ..., labels: list[str] | None = ..., assignee_ids: list[str] | None = ..., assigned_group_ids: list[str] | None = ..., activity_type: str | None = ...) -> Todo: ...',
  'workq.get': 'def get(self, *, todo_id: str) -> Todo | None: ...',
  'workq.list':
    'def list(self, *, status: str | None = ..., scope: str | None = ..., priority: str | None = ..., search: str | None = ...) -> list[Todo]: ...',
  'workq.update':
    'def update(self, *, todo_id: str, title: str | None = ..., description: str | None = ..., status: str | None = ..., priority: str | None = ..., due_date: str | None = ..., assignee_ids: list[str] | None = ..., assigned_group_ids: list[str] | None = ..., labels: list[str] | None = ...) -> Todo: ...',
  'workq.set_status': 'def set_status(self, *, todo_id: str, status: str) -> Todo: ...',
  'workq.assign':
    'def assign(self, *, todo_id: str, assignee_ids: list[str] | None = ..., assigned_group_ids: list[str] | None = ...) -> Todo: ...',
  'workq.complete': 'def complete(self, *, todo_id: str) -> Todo: ...',
  'workq.comment': 'def comment(self, *, todo_id: str, body: str) -> dict[str, Any]: ...',
  'workq.nudge': 'def nudge(self, *, todo_id: str) -> dict[str, Any]: ...',
  'workq.attach_form': 'def attach_form(self, *, todo_id: str, form_id: str) -> Todo: ...',
  'templates.list': 'def list(self, *, kind: str | None = ...) -> list[Template]: ...',
  'templates.get': 'def get(self, *, template_id: str) -> Template | None: ...',
  'templates.materialize':
    'def materialize(self, *, template_id: str, variables: dict[str, Any] | None = ..., portal_id: str | None = ...) -> dict[str, Any]: ...',
  'forms.list': 'def list(self, *, status: str | None = ...) -> dict[str, Any]: ...',
  'forms.get': 'def get(self, *, form_id: str) -> Form | None: ...',
  'forms.list_responses': 'def list_responses(self, *, form_id: str, cursor: str | None = ..., limit: int = ...) -> dict[str, Any]: ...',
  'forms.assign_to_portals':
    'def assign_to_portals(self, *, form_id: str, portal_ids: list[str]) -> dict[str, Any]: ...',
  'forms.create_from_template':
    'def create_from_template(self, *, form_template_id: str, values: dict[str, Any] | None = ..., name: str | None = ...) -> dict[str, Any]: ...',
  'users.list': 'def list(self) -> list[User]: ...',
  'users.get': 'def get(self, *, user_id: str) -> User | None: ...',
  'groups.list': 'def list(self) -> list[Group]: ...',
  'groups.members': 'def members(self, *, group_id: str) -> list[dict[str, Any]]: ...',
  'clients.list': 'def list(self, *, search: str | None = ...) -> list[Client]: ...',
  'clients.get': 'def get(self, *, client_id: str) -> Client | None: ...',
  'clients.create': 'def create(self, *, fields: dict[str, Any]) -> Client: ...',
  'clients.update': 'def update(self, *, client_id: str, fields: dict[str, Any]) -> Client: ...',
  'contacts.list': 'def list(self, *, search: str | None = ...) -> list[Contact]: ...',
  'contacts.get': 'def get(self, *, contact_id: str) -> Contact | None: ...',
  'contacts.create': 'def create(self, *, fields: dict[str, Any]) -> Contact: ...',
  'contacts.update': 'def update(self, *, contact_id: str, fields: dict[str, Any]) -> Contact: ...',
  'employees.list': 'def list(self, *, client_id: str) -> list[dict[str, Any]]: ...',
  'portals.list': 'def list(self) -> list[Portal]: ...',
  'portals.get': 'def get(self, *, portal_id: str) -> Portal | None: ...',
  // files.* renders inside the hard-coded _Files class (scope/scope_id select
  // WITHIN the automation's level grant — §4.2; omit them for the default).
  'files.list':
    'def list(self, *, path: str | None = ..., scope: str | None = ..., scope_id: str | None = ...) -> list[KnowledgeFile]: ...',
  'files.read':
    'def read(self, *, file: str, scope: str | None = ..., scope_id: str | None = ...) -> str: ...',
  'files.get':
    'def get(self, *, file: str, scope: str | None = ..., scope_id: str | None = ...) -> str: ...',
  'files.put':
    'def put(self, *, file: str, content: str | None = ..., scratch_file: str | None = ..., scope: str | None = ..., scope_id: str | None = ...) -> dict[str, Any]: ...',
  'files.delete':
    'def delete(self, *, file: str, scope: str | None = ..., scope_id: str | None = ...) -> dict[str, Any]: ...',
  'artifacts.put':
    'def put(self, *, title: str, content: str | None = ..., scratch_file: str | None = ..., file_name: str | None = ..., description: str | None = ..., kind: str | None = ..., visibility: str | None = ..., mime_type: str | None = ..., tags: list[str] | None = ...) -> dict[str, Any]: ...',
  'artifacts.get': 'def get(self, *, artifact_id: str) -> dict[str, Any]: ...',
  'artifacts.list':
    'def list(self, *, query: str | None = ..., kinds: list[str] | None = ..., statuses: list[str] | None = ..., tags: list[str] | None = ..., limit: int | None = ...) -> list[dict[str, Any]]: ...',
  'artifacts.share':
    'def share(self, *, artifact_id: str, label: str | None = ..., expires_at: str | None = ..., max_views: int | None = ...) -> dict[str, Any]: ...',
  'snapshots.query':
    'def query(self, *, portal_id: str | None = ..., source: str | None = ..., entity_type: str | None = ..., limit: int = ...) -> list[SnapshotRow]: ...',
  'snapshots.upsert':
    'def upsert(self, *, portal_id: str, source: str, entity_type: str, rows: list[dict], replace: bool = False) -> dict[str, Any]: ...',
  'portal_reports.get': 'def get(self, *, report_id: str) -> PortalReport | None: ...',
  'portal_reports.list': 'def list(self) -> list[PortalReport]: ...',
  'portal_reports.latest_published': 'def latest_published(self) -> PortalReport | None: ...',
  'portal_reports.metrics':
    'def metrics(self, *, report_id: str) -> list[dict[str, Any]]: ...',
  'portal_reports.read_image': 'def read_image(self, *, path: str) -> str: ...',
  'notify.send':
    'def send(self, *, title: str, body: str | None = ..., user_ids: list[str] | None = ..., group_ids: list[str] | None = ...) -> dict[str, Any]: ...',
  'connectors.invoke':
    'def invoke(self, *, server: str, tool: str, args: dict[str, Any] | None = ...) -> Any: ...',
  'ai.generate':
    'def generate(self, *, prompt: str, input: str | None = ..., system: str | None = ..., scratch_file: str | None = ...) -> str: ...',
  'ai.extract':
    'def extract(self, *, prompt: str, input: str | None = ..., schema_hint: str | None = ..., scratch_file: str | None = ...) -> Any: ...',
};

function fieldType(f: EventFieldDef): string {
  switch (f.type) {
    case 'number':
      return 'float';
    case 'boolean':
      return 'bool';
    default:
      return 'str';
  }
}

/** TriggerCtx subject fields merged (total=False) across the flow's event triggers. */
function triggerStub(ir: FlowIr): string {
  const fields = new Map<string, string>();
  for (const t of ir.triggers) {
    if (t.kind !== 'event') continue;
    const entry = getEventEntry(t.eventType);
    for (const f of entry?.subject ?? []) {
      fields.set(f.name, fieldType(f));
    }
  }
  const subjectFields =
    [...fields.entries()].map(([name, type]) => `    ${name}: ${type}`).join('\n') ||
    '    pass';
  return [
    'class _EventSubject(TypedDict, total=False):',
    subjectFields,
    '',
    'class _TriggerEvent(TypedDict, total=False):',
    '    eventType: str',
    '    subject: _EventSubject',
    '    payload: dict[str, Any]',
    '',
    'class TriggerCtx(TypedDict, total=False):',
    '    event: _TriggerEvent',
    '    kind: str',
    '    actor_user_id: str',
  ].join('\n');
}

export function buildEnvStub(ir: FlowIr, onlyNamespaces?: Set<string>): string {
  const byNamespace = new Map<string, string[]>();
  const filesSigs: string[] = [];
  for (const [key, sig] of Object.entries(API_STUB_SIGNATURES)) {
    const [ns] = key.split('.') as [string];
    // Per-node codegen passes the flow's declared-scope namespaces so each
    // node call carries only the API surface it may touch — smaller prompts,
    // and the model can't drift into undeclared namespaces.
    if (onlyNamespaces && !onlyNamespaces.has(ns)) continue;
    // Each signature carries its one-line doc as a comment — inert for
    // pyright, load-bearing for the AI generator (this same text is the
    // prompt's api reference).
    const doc = API_METHOD_DOCS[key];
    const lines = doc ? `    # ${doc}\n    ${sig}` : `    ${sig}`;
    // `files` renders inside the hard-coded _Files class below (it also
    // carries the sandbox-local scratch helpers), not as _Api_files.
    if (ns === 'files') {
      filesSigs.push(lines);
      continue;
    }
    const list = byNamespace.get(ns) ?? [];
    list.push(lines);
    byNamespace.set(ns, list);
  }

  const nsClasses = [...byNamespace.entries()]
    .map(([ns, sigs]) => `class _Api_${ns}:\n${sigs.join('\n')}`)
    .join('\n\n');

  const apiAttrs = [...byNamespace.keys()]
    .map((ns) => `    ${ns}: _Api_${ns}`)
    .join('\n');

  return [
    '# Generated by automations validation — the typed api.* surface.',
    'from typing import Any, TypedDict',
    '',
    ...ENTITY_ALIASES.map((a) => `${a} = dict[str, Any]`),
    '',
    triggerStub(ir),
    '',
    nsClasses,
    '',
    'class _Files:',
    '    def scratch_path(self, name: str) -> str: ...',
    '    def scratch_list(self) -> list[str]: ...',
    ...filesSigs,
    '',
    'class _Api:',
    apiAttrs,
    '    files: _Files',
    '    trigger: dict[str, Any]',
    '',
    'api: _Api',
    'trigger: TriggerCtx',
    '',
  ].join('\n');
}

/** Type of a node param — bindings inherit the upstream output's declared type. */
function paramPyType(p: ParamDef, ir: FlowIr): string {
  if (p.binding !== undefined && isBindingString(p.binding)) {
    try {
      const refs = stepRefsOf(parseBinding(p.binding));
      if (refs.length > 0) {
        const ref = refs[0]!;
        const node = ir.nodes.find((n) => n.id === ref.stepId);
        if (node?.kind === 'python') {
          const out = node.outputs.find((o: OutputDef) => o.name === ref.output);
          if (out) return pyType(out.type);
        }
        if (node?.kind === 'foreach' && ref.output === 'results') {
          return 'list[dict[str, Any]]';
        }
      }
    } catch {
      // malformed binding — semantics stage reports it; fall through to declared type
    }
  }
  return pyType(p.type);
}

/** Lines a generated cond file inserts BEFORE the verbatim condition. */
export const COND_PREAMBLE_LINES = 10;

/**
 * Type-check file for an if-node condition. Conditions run against plain
 * dicts (steps/trigger/params/item); typing `trigger` as TriggerCtx makes a
 * hallucinated trigger key (the "KeyError: 'actor'" class) a types-stage
 * error attributed to the if node — repairable at authoring time instead of
 * an unrepairable dry-run death.
 */
export function buildCondFile(node: Extract<FlowNode, { kind: 'if' }>): string {
  return [
    `# node ${node.id} — generated for type-checking the if-condition; never executed.`,
    'from typing import Any',
    'from _automation_env import trigger  # noqa: F401',
    '',
    'steps: dict[str, dict[str, dict[str, Any]]] = {}',
    'params: dict[str, Any] = {}',
    'item: Any = None',
    '',
    '# ── condition (verbatim) ──',
    '_cond = (',
    node.cond,
    ')',
    '',
  ].join('\n');
}

export function buildNodeFile(node: Extract<FlowNode, { kind: 'python' }>, ir: FlowIr): string {
  // Required params are plain keys (subscript access type-checks cleanly);
  // optional ones are NotRequired so forgetting them is fine but reading them
  // still types correctly.
  const paramFields =
    node.params
      .map((p) => {
        const t = paramPyType(p, ir);
        return `    ${p.name}: ${p.required ? t : `NotRequired[${t}]`}`;
      })
      .join('\n') || '    pass';
  const outputChecks = node.outputs
    .map((o) => `_out_${o.name}: ${pyType(o.type)} = ${o.name}  # declared output "${o.name}"`)
    .join('\n');

  return [
    `# node ${node.id} — generated for type-checking; never executed.`,
    'from typing import Any, TypedDict, NotRequired, cast',
    'from _automation_env import api, trigger  # noqa: F401',
    '',
    `class _Params_${node.id}(TypedDict):`,
    paramFields,
    '',
    `params = cast(_Params_${node.id}, {})`,
    '',
    '# ── node code (verbatim) ──',
    node.code,
    '',
    '# ── declared output checks ──',
    outputChecks,
    '',
  ].join('\n');
}
