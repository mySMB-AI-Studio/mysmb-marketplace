/**
 * EVENT_CATALOG — the single source of truth for platform events
 * (architecture/technical/automations.md §9).
 *
 * Every entry MUST have a real producer:
 *   emitter 'manager'  — a shared manager (or the route that owns the write
 *                        for tables without a manager) calls emitEvent() in
 *                        the same transaction as the mutation
 *   emitter 'scanner'  — the dispatcher's virtual-event scanners produce it,
 *                        deduped through platform_event_dedupe
 *   emitter 'run'      — the automation run lifecycle itself emits it
 *                        (subject to the depth guard)
 * A drift test (apps/web) scans the source tree and fails when an entry has
 * no emitter or an emitter uses an uncatalogued type — the catalog can never
 * quietly disagree with reality.
 *
 * `subject` lists the filterable fields (ids/labels only — never heavy or
 * sensitive data); event-trigger `filter` objects shallow-match against them
 * and the authoring stubs type `trigger.event.subject` from these defs.
 * Fuller change context (old/new values) goes in `payload`.
 */

export type EventFieldType = "string" | "number" | "boolean" | "uuid" | "date";

export interface EventFieldDef {
  name: string;
  type: EventFieldType;
  description?: string;
}

export interface EventCatalogEntry {
  type: string;
  label: string;
  component:
    | "WorkQ"
    | "Forms"
    | "Templates"
    | "Workspace"
    | "Client portal"
    | "Knowledge"
    | "Connectors"
    | "Snapshots"
    | "Portal reports"
    | "Opportunities"
    | "Artifacts"
    | "Records"
    | "Messaging"
    | "Automations";
  emitter: "manager" | "scanner" | "run";
  subject: EventFieldDef[];
  payloadDescription: string;
}

const todoSubject: EventFieldDef[] = [
  { name: "todo_id", type: "uuid" },
  { name: "title", type: "string" },
  { name: "status", type: "string" },
  { name: "priority", type: "string" },
  // item_kind was dropped in migration 0096 (forms are attachments now).
  { name: "scope", type: "string" },
  {
    name: "template_id",
    type: "uuid",
    description: "source Activity template when materialized",
  },
  { name: "portal_id", type: "uuid", description: "set for portal items" },
];

const formSubject: EventFieldDef[] = [
  { name: "form_id", type: "uuid" },
  { name: "title", type: "string" },
  { name: "status", type: "string" },
];

const clientSubject: EventFieldDef[] = [
  { name: "client_id", type: "uuid" },
  { name: "name", type: "string" },
  { name: "type", type: "string", description: "'business' | 'individual'" },
];

const artifactSubject: EventFieldDef[] = [
  { name: "artifact_id", type: "uuid" },
  { name: "title", type: "string" },
  {
    name: "kind",
    type: "string",
    description:
      "'document' | 'spreadsheet' | 'presentation' | 'image' | 'data' | 'code' | 'other'",
  },
  {
    name: "status",
    type: "string",
    description: "'draft' | 'ready' | 'archived'",
  },
  { name: "visibility", type: "string", description: "'private' | 'tenant'" },
  { name: "owner_user_id", type: "uuid" },
  {
    name: "source",
    type: "string",
    description: "'user' | 'twin' | 'agent' | 'automation' | 'system'",
  },
];

const opportunitySubject: EventFieldDef[] = [
  { name: "opportunity_id", type: "uuid" },
  { name: "title", type: "string" },
  {
    name: "stage",
    type: "string",
    description:
      "'new' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost'",
  },
  { name: "value_cents", type: "number" },
  {
    name: "client_id",
    type: "uuid",
    description: "null until a client is linked",
  },
  { name: "owner_user_id", type: "uuid" },
];

const contactSubject: EventFieldDef[] = [
  { name: "contact_id", type: "uuid" },
  { name: "name", type: "string" },
  { name: "email", type: "string" },
];

const portalSubject: EventFieldDef[] = [
  { name: "portal_id", type: "uuid" },
  { name: "client_id", type: "uuid" },
  { name: "name", type: "string" },
];

const knowledgeSubject: EventFieldDef[] = [
  {
    name: "path",
    type: "string",
    description: "scoped path (org/group/user root included)",
  },
  {
    name: "scope",
    type: "string",
    description: "'org' | 'group' | 'user' | 'portal'",
  },
  { name: "name", type: "string", description: "file or folder display name" },
];

const connectionSubject: EventFieldDef[] = [
  { name: "connection_id", type: "uuid" },
  { name: "name", type: "string" },
  { name: "plugin", type: "string" },
  { name: "mcp_server", type: "string" },
];

const reportSubject: EventFieldDef[] = [
  { name: "report_id", type: "uuid" },
  {
    name: "report_month",
    type: "date",
    description: "first day of the reporting month",
  },
  { name: "status", type: "string" },
];

const runSubject: EventFieldDef[] = [
  { name: "automation_id", type: "uuid" },
  { name: "run_id", type: "uuid" },
  { name: "automation_name", type: "string" },
  { name: "trigger_kind", type: "string" },
  { name: "status", type: "string" },
];

// Records Engine (architecture/technical/records-engine.md): every record
// event carries the type slug and stage so the shallow-equality trigger
// filter (`{ type_slug: 'contract', to: 'renewed' }`) works unchanged.
const recordSubject: EventFieldDef[] = [
  { name: "record_id", type: "uuid" },
  {
    name: "type_slug",
    type: "string",
    description: "the record type (e.g. supplier, contract)",
  },
  { name: "title", type: "string" },
  {
    name: "stage",
    type: "string",
    description:
      "current pipeline stage key; null for types without a pipeline",
  },
  { name: "owner_user_id", type: "uuid" },
];
const recordStageSubject: EventFieldDef[] = [
  ...recordSubject,
  { name: "from", type: "string", description: "previous stage key" },
  { name: "to", type: "string", description: "new stage key" },
];

export const EVENT_CATALOG: readonly EventCatalogEntry[] = [
  // ── WorkQ ──────────────────────────────────────────────────────────────────
  {
    type: "workq.item.created",
    label: "WorkQ item created",
    component: "WorkQ",
    emitter: "manager",
    subject: todoSubject,
    payloadDescription:
      "The created item fields (description, due_date, assignee ids, labels).",
  },
  {
    type: "workq.item.updated",
    label: "WorkQ item updated",
    component: "WorkQ",
    emitter: "manager",
    subject: todoSubject,
    payloadDescription: "Changed fields with old/new values.",
  },
  {
    type: "workq.item.form_attached",
    label: "Form attached to a WorkQ item",
    component: "WorkQ",
    emitter: "manager",
    subject: [...todoSubject, { name: "form_id", type: "uuid" }],
    payloadDescription: "A form was attached while creating or updating the item.",
  },
  {
    type: "workq.item.status_changed",
    label: "WorkQ item status changed",
    component: "WorkQ",
    emitter: "manager",
    subject: [...todoSubject, { name: "old_status", type: "string" }],
    payloadDescription:
      'from/to status values ("who did it" is the event actor_user_id, not a payload field).',
  },
  {
    type: "workq.item.assigned",
    label: "WorkQ item assigned",
    component: "WorkQ",
    emitter: "manager",
    subject: [...todoSubject, { name: "assignee_id", type: "uuid" }],
    payloadDescription: "Newly-added user/group assignees.",
  },
  {
    type: "workq.item.unassigned",
    label: "WorkQ item unassigned",
    component: "WorkQ",
    emitter: "manager",
    subject: [...todoSubject, { name: "assignee_id", type: "uuid" }],
    payloadDescription: "Removed user/group assignees.",
  },
  {
    type: "workq.item.claimed",
    label: "WorkQ item claimed",
    component: "WorkQ",
    emitter: "manager",
    subject: [...todoSubject, { name: "claimed_by", type: "uuid" }],
    payloadDescription: "Group-pool item claimed by a member.",
  },
  {
    type: "workq.item.completed",
    label: "WorkQ item completed",
    component: "WorkQ",
    emitter: "manager",
    subject: todoSubject,
    payloadDescription: "Item transitioned to done.",
  },
  {
    type: "workq.item.reopened",
    label: "WorkQ item reopened",
    component: "WorkQ",
    emitter: "manager",
    subject: todoSubject,
    payloadDescription:
      "Item transitioned out of done (incl. staff form reopen).",
  },
  {
    type: "workq.item.commented",
    label: "WorkQ item commented",
    component: "WorkQ",
    emitter: "manager",
    subject: [...todoSubject, { name: "comment_id", type: "uuid" }],
    payloadDescription: "Comment body (truncated), author, mentions.",
  },
  {
    type: "workq.item.deleted",
    label: "WorkQ item deleted",
    component: "WorkQ",
    emitter: "manager",
    subject: todoSubject,
    payloadDescription: "The deleted item snapshot.",
  },
  {
    type: "workq.item.due_soon",
    label: "WorkQ item due soon",
    component: "WorkQ",
    emitter: "scanner",
    subject: [
      ...todoSubject,
      { name: "due_date", type: "date" },
      { name: "hours_until_due", type: "number" },
      { name: "hours", type: "number" },
    ],
    payloadDescription:
      "Time scanner; one event per (todo, due_date, threshold), dedupe key due_soon:<todo_id>:<due_date>:<hours>. Trigger filter `{hours: N}` selects the threshold (default 24) and matches the subject `hours` field by equality.",
  },
  {
    type: "workq.item.overdue",
    label: "WorkQ item overdue",
    component: "WorkQ",
    emitter: "scanner",
    subject: [...todoSubject, { name: "due_date", type: "date" }],
    payloadDescription:
      "Time scanner; dedupe key overdue:<todo_id>:<due_date>.",
  },
  {
    type: "workq.item.stale",
    label: "WorkQ item has no activity",
    component: "WorkQ",
    emitter: "scanner",
    subject: [
      ...todoSubject,
      { name: "days_idle", type: "number" },
      { name: "days", type: "number" },
    ],
    payloadDescription:
      "Time scanner; fires when an open item has had NO activity (no update, comment, status/assignee change) for `days` days, measured from latest_event_at — so it covers newly-created AND long-existing items, keyed on last activity not creation. One event per idle stretch: dedupe key stale:<todo_id>:<days>:<latest_event_at_epoch> is anchored to the last activity, which does NOT move while the item stays idle — so the event fires ONCE and only re-arms after new activity bumps latest_event_at and another `days` days of silence pass. Trigger filter `{days: N}` selects the threshold (default 3) and matches the subject `days` field by equality. Pair with the workq.nudge action to auto-remind the assignee — that action writes activity, which re-anchors the window and so self-paces the reminders; pairing with a NON-mutating action (notify.send, connectors.invoke) yields exactly one event per idle stretch, not a recurring escalation. Note workq.nudge sends AS the automation owner and never nudges its own sender, so it reminds OTHER people about idle work, not the owner about their own — use notify.send for a self-reminder.",
  },

  // ── Forms ──────────────────────────────────────────────────────────────────
  {
    type: "form.created",
    label: "Form created",
    component: "Forms",
    emitter: "manager",
    subject: formSubject,
    payloadDescription: "Form metadata (source, question count).",
  },
  {
    type: "form.published",
    label: "Form published",
    component: "Forms",
    emitter: "manager",
    subject: formSubject,
    payloadDescription: "Portal ids the form was published to, display mode.",
  },
  {
    type: "form.assignment_created",
    label: "Form assigned to portal",
    component: "Forms",
    emitter: "manager",
    subject: [...formSubject, { name: "portal_id", type: "uuid" }],
    payloadDescription: "The created assignment (display mode).",
  },
  {
    type: "form.response_started",
    label: "Form response started",
    component: "Forms",
    emitter: "manager",
    subject: [
      ...formSubject,
      { name: "response_id", type: "uuid" },
      { name: "portal_id", type: "uuid" },
      { name: "todo_id", type: "uuid" },
    ],
    payloadDescription: "First draft save of a response.",
  },
  {
    type: "form.response_submitted",
    label: "Form response submitted",
    component: "Forms",
    emitter: "manager",
    subject: [
      ...formSubject,
      { name: "response_id", type: "uuid" },
      { name: "portal_id", type: "uuid" },
      { name: "todo_id", type: "uuid" },
    ],
    payloadDescription: "Submitted answers snapshot (question key → value).",
  },
  {
    type: "form.response_reopened",
    label: "Form response reopened",
    component: "Forms",
    emitter: "manager",
    subject: [
      ...formSubject,
      { name: "response_id", type: "uuid" },
      { name: "todo_id", type: "uuid" },
    ],
    payloadDescription: "Staff reopened a submitted response.",
  },

  // ── Templates / playbooks ─────────────────────────────────────────────────
  {
    type: "template.published",
    label: "Template published",
    component: "Templates",
    emitter: "manager",
    subject: [
      { name: "template_id", type: "uuid" },
      { name: "name", type: "string" },
      { name: "kind", type: "string", description: "'playbook' | 'form'" },
      { name: "version", type: "number" },
    ],
    payloadDescription: "Published version metadata.",
  },
  {
    type: "playbook.applied",
    label: "Template applied",
    component: "Templates",
    emitter: "manager",
    subject: [
      { name: "template_id", type: "uuid" },
      { name: "name", type: "string" },
      { name: "item_count", type: "number" },
    ],
    payloadDescription: "Materialized item ids per step key.",
  },

  // ── Workspace (users / groups) ────────────────────────────────────────────
  {
    type: "user.created",
    label: "User created",
    component: "Workspace",
    emitter: "manager",
    subject: [
      { name: "user_id", type: "uuid" },
      { name: "email", type: "string" },
      { name: "role", type: "string" },
      { name: "is_external", type: "boolean" },
    ],
    payloadDescription: "Invite/import source (manual, entra, portal).",
  },
  {
    type: "user.updated",
    label: "User updated",
    component: "Workspace",
    emitter: "manager",
    subject: [
      { name: "user_id", type: "uuid" },
      { name: "email", type: "string" },
      { name: "role", type: "string" },
    ],
    payloadDescription: "Changed fields (role, profile).",
  },
  {
    type: "user.deactivated",
    label: "User deactivated",
    component: "Workspace",
    emitter: "manager",
    subject: [
      { name: "user_id", type: "uuid" },
      { name: "email", type: "string" },
    ],
    payloadDescription: "users.disabled_at was set.",
  },
  {
    type: "group.created",
    label: "Group created",
    component: "Workspace",
    emitter: "manager",
    subject: [
      { name: "group_id", type: "uuid" },
      { name: "name", type: "string" },
      { name: "is_private", type: "boolean" },
    ],
    payloadDescription: "Group metadata.",
  },
  {
    type: "group.member_added",
    label: "Group member added",
    component: "Workspace",
    emitter: "manager",
    subject: [
      { name: "group_id", type: "uuid" },
      { name: "name", type: "string" },
      { name: "user_id", type: "uuid" },
    ],
    payloadDescription: "Membership added (manual or Entra sync).",
  },
  {
    type: "group.member_removed",
    label: "Group member removed",
    component: "Workspace",
    emitter: "manager",
    subject: [
      { name: "group_id", type: "uuid" },
      { name: "name", type: "string" },
      { name: "user_id", type: "uuid" },
    ],
    payloadDescription: "Membership removed.",
  },
  {
    type: "group.deleted",
    label: "Group deleted",
    component: "Workspace",
    emitter: "manager",
    subject: [
      { name: "group_id", type: "uuid" },
      { name: "name", type: "string" },
    ],
    payloadDescription: "The deleted group snapshot.",
  },

  // ── Client portal (CRM + portals) ─────────────────────────────────────────
  {
    type: "client.created",
    label: "Client created",
    component: "Client portal",
    emitter: "manager",
    subject: clientSubject,
    payloadDescription: "Client record fields.",
  },
  {
    type: "client.updated",
    label: "Client updated",
    component: "Client portal",
    emitter: "manager",
    subject: clientSubject,
    payloadDescription: "Changed fields with old/new values.",
  },
  {
    type: "client.deleted",
    label: "Client deleted",
    component: "Client portal",
    emitter: "manager",
    subject: clientSubject,
    payloadDescription: "The deleted client snapshot.",
  },
  {
    type: "opportunity.created",
    label: "Opportunity created",
    component: "Opportunities",
    emitter: "manager",
    subject: opportunitySubject,
    payloadDescription: "Opportunity record fields at creation.",
  },
  {
    type: "opportunity.updated",
    label: "Opportunity updated",
    component: "Opportunities",
    emitter: "manager",
    subject: opportunitySubject,
    payloadDescription: "Changed field names.",
  },
  {
    type: "opportunity.stage_changed",
    label: "Opportunity stage changed",
    component: "Opportunities",
    emitter: "manager",
    subject: opportunitySubject,
    payloadDescription:
      "Previous and new stage; lost reason when moving to lost.",
  },
  {
    type: "opportunity.won",
    label: "Opportunity won",
    component: "Opportunities",
    emitter: "manager",
    subject: opportunitySubject,
    payloadDescription:
      "Deal closed won — value and the client it closed against.",
  },
  {
    type: "opportunity.lost",
    label: "Opportunity lost",
    component: "Opportunities",
    emitter: "manager",
    subject: opportunitySubject,
    payloadDescription: "Deal closed lost — value and the categorised reason.",
  },
  {
    type: "opportunity.deleted",
    label: "Opportunity deleted",
    component: "Opportunities",
    emitter: "manager",
    subject: opportunitySubject,
    payloadDescription: "The deleted opportunity snapshot.",
  },
  {
    type: "contact.created",
    label: "Contact created",
    component: "Client portal",
    emitter: "manager",
    subject: contactSubject,
    payloadDescription: "Contact record fields.",
  },
  {
    type: "contact.updated",
    label: "Contact updated",
    component: "Client portal",
    emitter: "manager",
    subject: contactSubject,
    payloadDescription: "Changed fields with old/new values.",
  },
  {
    type: "contact.deleted",
    label: "Contact deleted",
    component: "Client portal",
    emitter: "manager",
    subject: contactSubject,
    payloadDescription: "The deleted contact snapshot.",
  },
  {
    type: "employee.assigned",
    label: "Employee assigned to client",
    component: "Client portal",
    emitter: "manager",
    subject: [
      { name: "client_id", type: "uuid" },
      { name: "user_id", type: "uuid" },
    ],
    payloadDescription:
      "Staff member assigned (portal staff membership follows when active).",
  },
  {
    type: "employee.unassigned",
    label: "Employee unassigned from client",
    component: "Client portal",
    emitter: "manager",
    subject: [
      { name: "client_id", type: "uuid" },
      { name: "user_id", type: "uuid" },
    ],
    payloadDescription: "Staff member unassigned.",
  },
  {
    type: "portal.enabled",
    label: "Client portal enabled",
    component: "Client portal",
    emitter: "manager",
    subject: portalSubject,
    payloadDescription: "Provisioned pages, member counts.",
  },
  {
    type: "portal.archived",
    label: "Client portal archived",
    component: "Client portal",
    emitter: "manager",
    subject: portalSubject,
    payloadDescription: "Portal soft-archived.",
  },
  {
    type: "portal.reactivated",
    label: "Client portal reactivated",
    component: "Client portal",
    emitter: "manager",
    subject: portalSubject,
    payloadDescription: "Portal set back to active.",
  },
  {
    type: "portal.membership_added",
    label: "Portal member added",
    component: "Client portal",
    emitter: "manager",
    subject: [
      ...portalSubject,
      { name: "user_id", type: "uuid" },
      {
        name: "member_role",
        type: "string",
        description: "'client' | 'staff'",
      },
    ],
    payloadDescription: "Membership row added.",
  },
  {
    type: "portal.membership_removed",
    label: "Portal member removed",
    component: "Client portal",
    emitter: "manager",
    subject: [
      ...portalSubject,
      { name: "user_id", type: "uuid" },
      { name: "member_role", type: "string" },
    ],
    payloadDescription: "Membership row removed.",
  },

  // ── Knowledge ─────────────────────────────────────────────────────────────
  {
    type: "knowledge.file_created",
    label: "Knowledge file created",
    component: "Knowledge",
    emitter: "manager",
    subject: knowledgeSubject,
    payloadDescription:
      "Uploader, size, mime. FS write commits before the event row (documented exception to same-transaction: knowledge is filesystem-backed).",
  },
  {
    type: "knowledge.file_updated",
    label: "Knowledge file updated",
    component: "Knowledge",
    emitter: "manager",
    subject: knowledgeSubject,
    payloadDescription: "Editor, new size.",
  },
  {
    type: "knowledge.file_deleted",
    label: "Knowledge file deleted",
    component: "Knowledge",
    emitter: "manager",
    subject: knowledgeSubject,
    payloadDescription: "Deleted path.",
  },
  // knowledge.file_moved is intentionally absent: no move/rename operation
  // exists in the knowledge stack — add the event WITH the feature.
  {
    type: "knowledge.folder_created",
    label: "Knowledge folder created",
    component: "Knowledge",
    emitter: "manager",
    subject: knowledgeSubject,
    payloadDescription: "Created folder path.",
  },
  {
    type: "knowledge.folder_deleted",
    label: "Knowledge folder deleted",
    component: "Knowledge",
    emitter: "manager",
    subject: knowledgeSubject,
    payloadDescription: "Deleted folder path (recursive).",
  },

  // ── Connectors (service connections) ──────────────────────────────────────
  {
    type: "connection.created",
    label: "Service connection created",
    component: "Connectors",
    emitter: "manager",
    subject: connectionSubject,
    payloadDescription: "Auth type; credential NOT included.",
  },
  {
    type: "connection.verified",
    label: "Service connection verified",
    component: "Connectors",
    emitter: "manager",
    subject: connectionSubject,
    payloadDescription: "Credential stored and status moved to connected.",
  },
  {
    type: "connection.failed",
    label: "Service connection failed",
    component: "Connectors",
    emitter: "manager",
    subject: connectionSubject,
    payloadDescription: "status_error (sanitized).",
  },
  {
    type: "connection.revoked",
    label: "Service connection revoked",
    component: "Connectors",
    emitter: "manager",
    subject: connectionSubject,
    payloadDescription: "Credential cleared; grants kept.",
  },
  {
    type: "connection.grant_added",
    label: "Connection grant added",
    component: "Connectors",
    emitter: "manager",
    subject: [...connectionSubject, { name: "grant_scope", type: "string" }],
    payloadDescription: "Grant target (user/group id).",
  },
  {
    type: "connection.grant_removed",
    label: "Connection grant removed",
    component: "Connectors",
    emitter: "manager",
    subject: [...connectionSubject, { name: "grant_scope", type: "string" }],
    payloadDescription: "Removed grant target.",
  },

  // ── Snapshots (portal data) ───────────────────────────────────────────────
  // The snapshot sync job is not built yet (portal-data-snapshots.ts documents
  // it as a follow-up), so ALL snapshot events come from the dispatcher's
  // watermark scanner — refreshed included. Move it to 'manager' when the
  // in-path sync job lands and can emit in its own transaction.
  {
    type: "snapshot.refreshed",
    label: "Portal data snapshot refreshed",
    component: "Snapshots",
    emitter: "scanner",
    subject: [
      { name: "portal_id", type: "uuid" },
      { name: "source", type: "string" },
      { name: "entity_type", type: "string" },
      { name: "row_count", type: "number" },
    ],
    payloadDescription:
      "The scanner observed a new synced_at batch for (portal, source, entity_type). Dedupe key snap_refresh:<portal>:<source>:<entity>:<synced_at>.",
  },
  {
    type: "snapshot.row_added",
    label: "Snapshot row added",
    component: "Snapshots",
    emitter: "scanner",
    subject: [
      { name: "portal_id", type: "uuid" },
      { name: "source", type: "string" },
      { name: "entity_type", type: "string" },
      { name: "external_id", type: "string" },
    ],
    payloadDescription:
      "Diff on refresh by contract key; payload carries { new }. Dedupe key snap_add:<portal>:<source>:<entity>:<external_id>:<observed>.",
  },
  {
    type: "snapshot.row_changed",
    label: "Snapshot row changed",
    component: "Snapshots",
    emitter: "scanner",
    subject: [
      { name: "portal_id", type: "uuid" },
      { name: "source", type: "string" },
      { name: "entity_type", type: "string" },
      { name: "external_id", type: "string" },
    ],
    payloadDescription:
      "The source observed a newer state for the row (observed_at bumped). Dedupe key snap_change:<…>:<observed_at>. payload carries { new }.",
  },
  // snapshot.row_removed is intentionally absent: removal cannot be observed
  // from the snapshot table alone (rows are upserted, not tombstoned) — it
  // arrives WITH the future sync job, which can diff its keyset in-path.

  // ── Portal reports ────────────────────────────────────────────────────────
  {
    type: "portal_report.created",
    label: "Monthly report created",
    component: "Portal reports",
    emitter: "manager",
    subject: reportSubject,
    payloadDescription: "Draft report created for a month.",
  },
  {
    type: "portal_report.updated",
    label: "Monthly report updated",
    component: "Portal reports",
    emitter: "manager",
    subject: reportSubject,
    payloadDescription: "Status/gallery/pdf changes (event posts included).",
  },
  {
    type: "portal_report.published",
    label: "Monthly report published",
    component: "Portal reports",
    emitter: "manager",
    subject: reportSubject,
    payloadDescription:
      "Report published to all portals; metrics recompute follows.",
  },

  // ── Artifacts ─────────────────────────────────────────────────────────────
  // Emitted by ArtifactManager in the same transaction as the write. The
  // subject carries labels and ids only — never the storage key, the checksum,
  // or anything derived from the bytes, which are not automation-filterable
  // and would leak content shape into the event log.
  {
    type: "artifact.created",
    label: "Artifact created",
    component: "Artifacts",
    emitter: "manager",
    subject: artifactSubject,
    payloadDescription:
      "First version stored; payload carries size_bytes and mime_type.",
  },
  {
    type: "artifact.updated",
    label: "Artifact updated",
    component: "Artifacts",
    emitter: "manager",
    subject: artifactSubject,
    payloadDescription:
      "Metadata patch (payload.changed lists the fields) or a content replacement (payload.version, payload.size_bytes).",
  },
  {
    type: "artifact.deleted",
    label: "Artifact deleted",
    component: "Artifacts",
    emitter: "manager",
    subject: artifactSubject,
    payloadDescription: "Row, grants, links and every stored version removed.",
  },
  {
    type: "artifact.shared",
    label: "Artifact shared",
    component: "Artifacts",
    emitter: "manager",
    subject: [
      ...artifactSubject,
      {
        name: "grant_scope",
        type: "string",
        description: "'user' | 'group' | 'link'",
      },
    ],
    payloadDescription:
      "payload.via is 'grant' (with subject_id + access) or 'link' (with expires_at + max_views). Never the token.",
  },

  // ── Automations (meta — depth-guarded) ────────────────────────────────────
  {
    type: "automation.run_started",
    label: "Automation run started",
    component: "Automations",
    emitter: "run",
    subject: runSubject,
    payloadDescription: "Run began executing.",
  },
  {
    type: "automation.run_succeeded",
    label: "Automation run succeeded",
    component: "Automations",
    emitter: "run",
    subject: runSubject,
    payloadDescription: "Run finished; payload carries step counts + duration.",
  },
  {
    type: "automation.run_failed",
    label: "Automation run failed",
    component: "Automations",
    emitter: "run",
    subject: runSubject,
    payloadDescription:
      "Run failed; payload carries the error and failing node.",
  },
  {
    type: "automation.paused",
    label: "Automation paused",
    component: "Automations",
    emitter: "run",
    subject: [
      { name: "automation_id", type: "uuid" },
      { name: "automation_name", type: "string" },
      {
        name: "reason",
        type: "string",
        description: "'circuit_breaker' | 'owner_unavailable'",
      },
    ],
    payloadDescription: "Automatic pause with reason.",
  },

  // ── Records Engine ────────────────────────────────────────────────────────
  {
    type: "record.created",
    label: "Record created",
    component: "Records",
    emitter: "manager",
    subject: recordSubject,
    payloadDescription:
      "Promoted values (title, owner, stage) and the live data keys set at creation.",
  },
  {
    type: "record.updated",
    label: "Record updated",
    component: "Records",
    emitter: "manager",
    subject: recordSubject,
    payloadDescription: "Changed field keys (`changed`).",
  },
  {
    type: "record.stage_changed",
    label: "Record stage changed",
    component: "Records",
    emitter: "manager",
    subject: recordStageSubject,
    payloadDescription:
      "Every stage move; `closed` true when the destination stage is closed.",
  },
  {
    type: "record.closed",
    label: "Record closed",
    component: "Records",
    emitter: "manager",
    subject: recordStageSubject,
    payloadDescription:
      "Fires alongside stage_changed when a record enters a closed stage.",
  },
  {
    type: "record.reopened",
    label: "Record reopened",
    component: "Records",
    emitter: "manager",
    subject: recordStageSubject,
    payloadDescription:
      "Fires alongside stage_changed when a record leaves a closed stage for an open one.",
  },
  {
    type: "record.deleted",
    label: "Record deleted",
    component: "Records",
    emitter: "manager",
    subject: recordSubject,
    payloadDescription:
      "Soft deletion (archive) or purge; `purged` true for physical deletion.",
  },
  {
    type: "record.linked",
    label: "Record linked",
    component: "Records",
    emitter: "manager",
    subject: [
      ...recordSubject,
      { name: "field_key", type: "string" },
      { name: "target_kind", type: "string" },
      { name: "target_id", type: "uuid" },
    ],
    payloadDescription: "A relation link was added on the source record.",
  },
  {
    type: "record.unlinked",
    label: "Record unlinked",
    component: "Records",
    emitter: "manager",
    subject: [
      ...recordSubject,
      { name: "field_key", type: "string" },
      { name: "target_kind", type: "string" },
      { name: "target_id", type: "uuid" },
    ],
    payloadDescription:
      "A relation link was removed (by edit or because the target was deleted).",
  },
  {
    type: "record.note_added",
    label: "Record note added",
    component: "Records",
    emitter: "manager",
    subject: [...recordSubject, { name: "activity_id", type: "uuid" }],
    payloadDescription: "Note body (truncated) and author.",
  },
  {
    type: "records.type_published",
    label: "Record type published",
    component: "Records",
    emitter: "manager",
    subject: [
      { name: "type_slug", type: "string" },
      { name: "version", type: "number" },
      { name: "label_plural", type: "string" },
    ],
    payloadDescription:
      "A record type was published or its published definition changed (new version); `groups` lists the groups granted access.",
  },

  // ── Messaging (WhatsApp channel) ─────────────────────────────────────────
  // Emitted by the inbound ingester (apps/web/src/lib/messaging) after the
  // message row commits; the pure subject/payload builder lives in
  // packages/shared/src/messaging/compose-notification.ts.
  {
    type: "messaging.message.received",
    label: "Messaging message received",
    component: "Messaging",
    emitter: "manager",
    subject: [
      { name: "conversation_id", type: "uuid" },
      { name: "channel_id", type: "uuid" },
      {
        name: "contact_id",
        type: "uuid",
        description: "set when the sender matched exactly one contact",
      },
      {
        name: "client_id",
        type: "uuid",
        description: "set when the sender matched exactly one client",
      },
      { name: "from", type: "string", description: "sender, E.164" },
      {
        name: "message_type",
        type: "string",
        description: "text | image | document | audio | video | sticker | location | unsupported",
      },
    ],
    payloadDescription:
      "message_id (wamid), body (text or caption, truncated) and contact_name; media bytes are never included.",
  },
] as const;

const BY_TYPE = new Map(EVENT_CATALOG.map((e) => [e.type, e]));

export function getEventEntry(type: string): EventCatalogEntry | undefined {
  return BY_TYPE.get(type);
}

export function isEventType(type: string): boolean {
  return BY_TYPE.has(type);
}

export const EVENT_TYPES: readonly string[] = EVENT_CATALOG.map((e) => e.type);
