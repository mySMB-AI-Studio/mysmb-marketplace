import { createHash } from "node:crypto";
import { z } from "zod";

/** Portable contract parity with myHubV2 plugins/setup-schema.ts and
 * records/portable-schema.ts. Workspace owns runtime authority/publication. */
const recordKey = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/);
const setupKey = z.string().regex(/^[a-z][a-z0-9_]*$/).max(80).refine(
  (value) => !/(?:password|secret|token|credential|api_key|private_key)/i.test(value),
  "Setup stores nonsecret configuration only; use Connections for credentials",
);
const scalar = z.union([z.string().max(4000), z.number().finite(), z.boolean()]);
export const setupDefinitionSchema = z.object({
  version: z.literal(1),
  steps: z.array(z.object({
    id: setupKey, title: z.string().trim().min(1).max(200), description: z.string().max(2000).optional(),
    fields: z.array(z.object({
      key: setupKey, label: z.string().trim().min(1).max(200), type: z.enum(["string", "number", "boolean", "select"]),
      required: z.boolean().optional(), default: scalar.optional(),
      options: z.array(z.object({ value: z.string().max(200), label: z.string().min(1).max(200) }).strict()).max(100).optional(),
      helpText: z.string().max(2000).optional(),
    }).strict()).max(100),
    connectors: z.array(z.object({
      key: setupKey, server: z.string().min(1).max(200), label: z.string().min(1).max(200),
      required: z.boolean().optional(), scope: z.enum(["personal", "service", "either"]),
    }).strict()).max(50),
  }).strict()).min(1).max(30),
}).strict().superRefine((definition, ctx) => {
  const ids = new Set<string>(), keys = new Set<string>();
  for (const step of definition.steps) {
    if (ids.has(step.id)) ctx.addIssue({ code: "custom", message: "Step ids must be unique" });
    ids.add(step.id);
    for (const field of step.fields) {
      if (field.type === "select" && !field.options?.length) ctx.addIssue({ code: "custom", message: "Select fields need options" });
      if (field.default !== undefined) {
        const valid = field.type === "boolean" ? typeof field.default === "boolean"
          : field.type === "number" ? typeof field.default === "number" && Number.isFinite(field.default)
          : typeof field.default === "string" && (field.type !== "select" || field.options?.some((option) => option.value === field.default));
        if (!valid) ctx.addIssue({ code: "custom", message: "Default must match the field type/options" });
      }
    }
    for (const item of [...step.fields, ...step.connectors]) {
      if (keys.has(item.key)) ctx.addIssue({ code: "custom", message: "Setup keys must be unique" });
      keys.add(item.key);
    }
  }
});
const condition = z.object({ field: recordKey, op: z.enum(["eq", "in", "is_closed"]), value: z.unknown().optional() }).strict();
const rule = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("required_when"), when: condition }).strict(),
  z.object({ kind: z.literal("only_when"), when: condition }).strict(),
  z.object({ kind: z.literal("unique_within_type") }).strict(),
  z.object({ kind: z.literal("min"), value: z.union([z.number().finite(), z.string().max(100)]) }).strict(),
  z.object({ kind: z.literal("max"), value: z.union([z.number().finite(), z.string().max(100)]) }).strict(),
]);
const portalAccess = z.object({
  enabled: z.boolean(), operations: z.array(z.enum(["read", "create", "update", "delete"])).max(4),
  visibleFields: z.array(z.string().min(1).max(40)).max(100), editableFields: z.array(z.string().min(1).max(40)).max(100),
}).strict();
export const proposalTypeSchema = z.object({
  slug: z.string().regex(/^[a-z][a-z0-9_]{1,39}$/), labelSingular: z.string().min(1).max(80), labelPlural: z.string().min(1).max(80),
  description: z.string().max(2000).nullable().optional(), icon: z.string().max(80).nullable().optional(), color: z.string().max(30).nullable().optional(),
  titleFieldKey: recordKey.optional(),
  settings: z.object({
    portalAccess: portalAccess.optional(), eventAliases: z.record(z.string(), z.string()).optional(),
    defaultSort: z.object({ key: z.string(), dir: z.enum(["asc", "desc"]) }).optional(), detailGroups: z.array(z.string()).optional(),
    sectionMeta: z.record(z.string(), z.object({ color: z.string().optional(), columns: z.union([z.literal(1), z.literal(2)]).optional() })).optional(),
    controlSlots: z.record(z.string(), z.string().nullable()).optional(),
  }).strict().optional(),
  fields: z.array(z.object({
    key: recordKey, label: z.string().min(1).max(80), kind: z.enum(["text", "long_text", "number", "percent", "money", "date", "datetime", "boolean", "select", "multi_select", "user", "relation", "email", "phone", "url", "pipeline"]),
    config: z.record(z.string(), z.unknown()).optional(), required: z.boolean().optional(), rules: z.array(rule).max(60).optional(),
    promoted: z.enum(["title", "owner", "stage"]).nullable().optional(), groupLabel: z.string().max(80).nullable().optional(), position: z.number().int().min(0).optional(),
    showInList: z.boolean().optional(), showInDetail: z.boolean().optional(), searchable: z.boolean().optional(),
  }).strict()).min(1).max(60),
}).strict().superRefine((definition, ctx) => {
  const policy = definition.settings?.portalAccess;
  if (!policy) return;
  const fail = (message: string) => ctx.addIssue({ code: "custom", path: ["settings", "portalAccess"], message });
  const titleKey = definition.titleFieldKey ?? definition.fields.find((field) => field.promoted === "title")?.key ?? (definition.fields.some((field) => field.key === "name") ? "name" : definition.fields[0]?.key);
  const normalized = definition.fields.map((field) => ({ ...field, required: field.required ?? field.key === titleKey, promoted: field.promoted !== undefined ? field.promoted : field.kind === "pipeline" ? "stage" : field.key === titleKey && field.kind === "text" ? "title" : null }));
  const fields = new Map(normalized.map((field) => [field.key, field]));
  const title = normalized.find((field) => field.promoted === "title");
  for (const key of [...policy.visibleFields, ...policy.editableFields]) {
    const field = fields.get(key);
    if (!field) fail(`Unknown portal field ${key}`);
    else if (field.kind === "user" || field.kind === "pipeline" || field.promoted === "owner" || field.promoted === "stage") fail(`Portal access to ${key} is unsupported`);
  }
  if (policy.editableFields.some((key) => !policy.visibleFields.includes(key))) fail("Editable portal fields must also be visible");
  if (policy.editableFields.some((key) => {
    const field = fields.get(key);
    return field?.kind === "relation" && (typeof field.config?.target !== "string" || !field.config.target.startsWith("record:"));
  })) fail("Portal relation edits require a custom record target");
  if (policy.enabled && (!policy.operations.includes("read") || !title || !policy.visibleFields.includes(title.key))) fail("Portal access requires read permission and a visible title field");
  if (policy.enabled && policy.operations.includes("create")) {
    if (title && !policy.editableFields.includes(title.key)) fail("Portal creation requires an editable title field");
    for (const field of normalized) if (field.required && !policy.editableFields.includes(field.key)) fail(`Portal creation requires an editable required field ${field.key}`);
  }
  if (policy.enabled) for (const field of normalized) if (!policy.visibleFields.includes(field.key)) for (const item of field.rules ?? []) {
    if (item.kind === "only_when" && policy.editableFields.includes(item.when.field)) fail("Portal edits cannot clear a hidden field through an only_when rule");
  }
});
const identity = { originKey: z.string().uuid(), contentHash: z.string().regex(/^[a-f0-9]{64}$/), name: z.string().min(1).max(200) };
const schemas = {
  record_type: z.object({ kind: z.literal("record_type"), ...identity, definition: proposalTypeSchema }).strict(),
  setup: z.object({ kind: z.literal("setup"), ...identity, description: z.string().max(4000).optional(), definition: setupDefinitionSchema }).strict(),
};
export function canonicalJson(value: unknown): string {
  const sortKeys = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(sortKeys);
    if (input !== null && typeof input === "object") {
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(input).sort()) {
        const entry = (input as Record<string, unknown>)[key];
        if (entry !== undefined) sorted[key] = sortKeys(entry);
      }
      return sorted;
    }
    return input;
  };
  return JSON.stringify(sortKeys(value));
}
export function validatePortableContent(kind: "record_type" | "setup", raw: unknown): void {
  if ((JSON.stringify(raw)?.length ?? 0) > 1_000_000) throw new Error("Portable component exceeds the 1 MB limit");
  schemas[kind].parse(raw);
  const { contentHash, ...content } = raw as Record<string, unknown>;
  if (createHash("sha256").update(canonicalJson(content)).digest("hex") !== contentHash) throw new Error("Portable component contentHash does not match its content");
}
export function setupKeys(raw: unknown): string[] {
  return setupDefinitionSchema.parse(raw).steps.flatMap((step) => [...step.fields, ...step.connectors].map((entry) => entry.key));
}
