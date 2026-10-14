/**
 * Automation scopes — the OAuth-consent-style capability vocabulary
 * (architecture/technical/automations.md §4).
 *
 * Every automation version declares the scopes its flow needs; they are shown
 * at publish time like a consent screen. At runtime the bridge enforces
 * effective access = acting identity's permissions ∩ declared scopes — a call
 * outside the declared set raises ScopeError, never a silent skip.
 *
 * Dynamic families name the exact MCP server or custom table used by a flow.
 */

export const AUTOMATION_SCOPES = [
  'workq:read',
  'workq:write',
  'forms:read',
  'forms:write',
  'templates:read',
  'templates:apply',
  'files:read',
  'files:write',
  'artifacts:read',
  'artifacts:write',
  'users:read',
  'groups:read',
  'clients:read',
  'clients:write',
  'contacts:read',
  'contacts:write',
  'employees:read',
  'portals:read',
  'snapshots:read',
  'snapshots:write',
  'portal_reports:read',
  'portal_reports:write',
  'notify:send',
  'ai:generate',
  'extension_setup:read',
] as const;

export type FixedAutomationScope = (typeof AUTOMATION_SCOPES)[number];
export type AutomationScope = FixedAutomationScope | `connectors:${string}` | `records:${string}:read` | `records:${string}:write`;

const FIXED = new Set<string>(AUTOMATION_SCOPES);
const CONNECTOR_PREFIX = 'connectors:';
const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const RECORD_SCOPE = /^records:([a-z][a-z0-9_]{1,39}):(read|write)$/;

export function isAutomationScope(value: unknown): value is AutomationScope {
  if (typeof value !== 'string') return false;
  if (FIXED.has(value)) return true;
  if (RECORD_SCOPE.test(value)) return true;
  if (value.startsWith(CONNECTOR_PREFIX)) {
    return SLUG.test(value.slice(CONNECTOR_PREFIX.length));
  }
  return false;
}

/** Human labels for the publish-time consent screen. */
export const AUTOMATION_SCOPE_LABELS: Record<FixedAutomationScope, string> = {
  'workq:read': 'Read WorkQ items, comments and activity',
  'workq:write': 'Create and update WorkQ items',
  'forms:read': 'Read forms and responses',
  'forms:write': 'Create and assign forms',
  'templates:read': 'Read templates and playbooks',
  'templates:apply': 'Apply templates (materialize real items)',
  'files:read': "Read files from this automation's filesystem",
  'files:write': "Create, update and delete files in this automation's filesystem",
  'artifacts:read': 'Read artifacts this automation can see',
  'artifacts:write': 'Save artifacts (documents, PDFs, images) as this automation',
  'users:read': 'Read workspace users',
  'groups:read': 'Read workspace groups and members',
  'clients:read': 'Read clients',
  'clients:write': 'Create and update clients',
  'contacts:read': 'Read contacts',
  'contacts:write': 'Create and update contacts',
  'employees:read': 'Read client-team assignments',
  'portals:read': 'Read client portal metadata',
  'snapshots:read': 'Read portal data snapshots',
  'snapshots:write': 'Write portal data snapshots',
  'portal_reports:read': 'Read monthly reports, metrics and photos',
  'portal_reports:write': 'Update monthly reports',
  'notify:send': 'Send in-app notifications',
  'ai:generate': 'Generate text with AI',
  'extension_setup:read': 'Read the installed extension configuration',
};

export function labelForScope(scope: string): string {
  const record = RECORD_SCOPE.exec(scope);
  if (record) return `${record[2] === 'read' ? 'Read' : 'Create, update and delete'} ${record[1]} custom records`;
  if (scope.startsWith(CONNECTOR_PREFIX)) {
    return `Invoke the ${scope.slice(CONNECTOR_PREFIX.length)} connector`;
  }
  return AUTOMATION_SCOPE_LABELS[scope as FixedAutomationScope] ?? scope;
}
