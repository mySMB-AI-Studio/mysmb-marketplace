/**
 * Business-agent package rules for the marketplace validator (scripts/validate.ts).
 *
 * Pure helpers — no repo walking — so every rule is unit-testable from
 * scripts/agent-packages.test.ts without building a registry on disk:
 *
 *   - semver: strict versions (agent packages) and dependency ranges
 *   - dependencies[]: shape, resolution against the registry, acyclicity
 *   - version agreement between plugin.json and the marketplace.json entry
 *   - listing.agent / release block shapes
 *   - structural validation of process / capability / evaluation definitions
 *     against contracts/studio-contracts-v1.json (ajv, JSON Schema 2020-12)
 *   - the cross-references a process definition makes (capabilities,
 *     automations, forms, templates, evaluations)
 *   - what a process definition READS: step outputs, materiality keys, recipients,
 *     event triggers (a copy of the Workspace's step-output model)
 *   - the entry's `withdrawn` block
 *
 * Authority. The Workspace (myHubV2 packages/shared/src/process/) owns the
 * contracts; contracts/studio-contracts-v1.json is the generated artefact it
 * publishes, copied here UNCHANGED — never hand-edit it, copy the new file
 * when the Workspace regenerates it. The semver and listing.agent rules mirror
 * packages/shared/src/plugins/marketplace-manifest.ts. JSON Schema covers
 * SHAPE only; the Workspace's own semantic validator (reachability, terminal
 * outcomes, decision eligibility, ...) and the publish-time lockfile remain
 * the authority for everything the registry cannot see statically.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import type { ErrorObject, ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import { canonicalJson } from "./extension-content";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// ── Semver ────────────────────────────────────────────────────────────────────
// Mirrors marketplace-manifest.ts (Workspace) so a version the registry accepts
// is one the Workspace accepts. Character classes instead of backslash escapes:
// these are assembled into RegExp source from string fragments.

const SEMVER_NUMBER = "(?:0|[1-9][0-9]*)";
const SEMVER_PRERELEASE = "(?:-[0-9A-Za-z-]+(?:[.][0-9A-Za-z-]+)*)";

/** x.y.z with an optional prerelease and NO build metadata (it does not order). */
const STRICT_SEMVER_RE = new RegExp(
  `^${SEMVER_NUMBER}[.]${SEMVER_NUMBER}[.]${SEMVER_NUMBER}${SEMVER_PRERELEASE}?$`,
);

/**
 * A dependency range, deliberately conservative: an exact version, a caret or
 * tilde range over a full version, or an x-range (`1.x`, `1.2.x`; `*` accepted
 * as the wildcard). Comparators (`>=`), hyphen ranges, `||` unions, partial
 * carets (`^1.2`) and a bare `*` are refused — a dependency that can resolve
 * to "anything" cannot be locked at publish time.
 */
const SEMVER_RANGE_RE = new RegExp(
  `^(?:[~^]?${SEMVER_NUMBER}[.]${SEMVER_NUMBER}[.]${SEMVER_NUMBER}${SEMVER_PRERELEASE}?` +
    `|${SEMVER_NUMBER}[.][xX*]` +
    `|${SEMVER_NUMBER}[.]${SEMVER_NUMBER}[.][xX*])$`,
);

export function isStrictSemver(version: string): boolean {
  return STRICT_SEMVER_RE.test(version);
}

export function isSemverRange(range: string): boolean {
  return SEMVER_RANGE_RE.test(range);
}

const RANGE_HINT = `an exact version, a ^ or ~ range, or an x-range such as "^1.2.0", "~1.2.3" or "1.x"`;

// ── Content hash ──────────────────────────────────────────────────────────────

export const CONTENT_HASH_RE = /^[a-f0-9]{64}$/;

/**
 * The contentHash the Workspace assembler stamps (withContentHash in
 * plugins/authoring/bundle.ts): sha256 of the canonical (recursively key-sorted)
 * JSON of the payload WITHOUT its contentHash field.
 */
export function contentHashOf(payload: Record<string, unknown>): string {
  const { contentHash: _ignored, ...content } = payload;
  return createHash("sha256").update(canonicalJson(content)).digest("hex");
}

// ── Studio contract artefact (ajv) ────────────────────────────────────────────

export const STUDIO_KINDS = ["process", "capability", "evaluation"] as const;
export type StudioKind = (typeof STUDIO_KINDS)[number];

/** The artefact major this validator understands (the file name carries it too). */
export const STUDIO_CONTRACT_VERSION = 1;

export class StudioContractError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StudioContractError";
  }
}

export interface SchemaIssue {
  /** JSON pointer relative to the definition ("" is the definition itself). */
  pointer: string;
  message: string;
}

export interface StudioSchemaValidators {
  /** Structural issues of `definition` against the artefact's schema for `kind`; [] when it conforms. */
  validate(kind: StudioKind, definition: unknown): SchemaIssue[];
}

/**
 * Compile the three schemas of the artefact at `path`. Throws a
 * StudioContractError (actionable message) when the file is missing,
 * unparseable, a different major, or a schema does not compile.
 */
export function loadStudioSchemaValidators(path: string): StudioSchemaValidators {
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    throw new StudioContractError(
      `cannot read the Studio contract artefact ${path}: ${(err as Error).message} — copy contracts/studio-contracts-v1.json from the Workspace repo`,
    );
  }
  let contracts: unknown;
  try {
    contracts = JSON.parse(raw);
  } catch (err) {
    throw new StudioContractError(`Studio contract artefact ${path} is not valid JSON: ${(err as Error).message}`);
  }
  if (!isRecord(contracts) || contracts.version !== STUDIO_CONTRACT_VERSION || !isRecord(contracts.schemas)) {
    throw new StudioContractError(
      `Studio contract artefact ${path} must be { version: ${STUDIO_CONTRACT_VERSION}, schemas: { process, capability, evaluation } } — this validator understands contract major ${STUDIO_CONTRACT_VERSION} only`,
    );
  }
  // zod emits `format: "uuid"` next to a stricter `pattern`; ajv-formats knows the format.
  const ajv = new Ajv2020({ allErrors: true });
  addFormats(ajv);
  const compiled = {} as Record<StudioKind, ValidateFunction>;
  for (const kind of STUDIO_KINDS) {
    const schema = contracts.schemas[kind];
    if (!isRecord(schema)) {
      throw new StudioContractError(`Studio contract artefact ${path} has no "${kind}" schema`);
    }
    try {
      compiled[kind] = ajv.compile(schema);
    } catch (err) {
      throw new StudioContractError(`Studio contract artefact ${path}: the "${kind}" schema does not compile: ${(err as Error).message}`);
    }
  }
  return {
    validate(kind, definition) {
      const validate = compiled[kind];
      if (validate(definition)) return [];
      return formatSchemaErrors(validate.errors ?? []);
    },
  };
}

/**
 * zod emits unions as oneOf/anyOf, and ajv (allErrors) reports every branch's
 * failures — for a step of kind "agent" missing `skill`, also seven "must be
 * equal to constant" lines for the other step kinds. Reduce each union to what
 * the author needs: the one branch that nearly matched, or a single "must be
 * one of" when the discriminator itself is wrong.
 */
function pruneUnionNoise(errors: ErrorObject[]): ErrorObject[] {
  let remaining = [...errors];
  const unions = errors
    .filter((e) => e.keyword === "oneOf" || e.keyword === "anyOf")
    .sort((a, b) => b.schemaPath.length - a.schemaPath.length); // innermost first
  for (const union of unions) {
    const prefix = `${union.schemaPath}/`;
    const inside = (e: ErrorObject) =>
      e !== union &&
      e.schemaPath.startsWith(prefix) &&
      (e.instancePath === union.instancePath || e.instancePath.startsWith(`${union.instancePath}/`));
    const branchErrors = remaining.filter(inside);
    const byBranch = new Map<string, ErrorObject[]>();
    for (const e of branchErrors) {
      const branch = e.schemaPath.slice(prefix.length).split("/")[0];
      byBranch.set(branch, [...(byBranch.get(branch) ?? []), e]);
    }
    const groups = [...byBranch.values()];
    if (groups.length === 0) continue;
    const dropped = new Set<ErrorObject>([union, ...branchErrors]);
    const matchedSeveral = union.keyword === "oneOf" && (union.params as { passingSchemas?: unknown }).passingSchemas != null;
    if (matchedSeveral) {
      // More than one branch matched: the union error alone says so.
      remaining = remaining.filter((e) => !inside(e));
      continue;
    }
    // Discriminator mismatch: every branch fails the same `const` at the same path.
    const firstConsts = groups[0].filter((e) => e.keyword === "const");
    const discriminator = firstConsts.find((c) =>
      groups.every((g) => g.some((e) => e.keyword === "const" && e.instancePath === c.instancePath)),
    );
    const replacement: ErrorObject[] = [];
    if (discriminator) {
      const allowed = groups.flatMap((g) =>
        g.filter((e) => e.keyword === "const" && e.instancePath === discriminator.instancePath).map((e) => (e.params as { allowedValue: unknown }).allowedValue),
      );
      replacement.push({
        ...discriminator,
        keyword: "enum",
        params: { allowedValues: [...new Set(allowed)] },
        message: "must be equal to one of the allowed values",
      });
    } else {
      const fewest = Math.min(...groups.map((g) => g.length));
      replacement.push(...groups.filter((g) => g.length === fewest).flat());
    }
    remaining = [...remaining.filter((e) => !dropped.has(e)), ...replacement];
  }
  return remaining;
}

const UUID_PATTERN_PREFIX = "^([0-9a-fA-F]{8}-";
const SEMVER_PATTERN_PREFIX = "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.";
const PATTERN_ECHO_MAX = 60;

function formatSchemaErrors(errors: ErrorObject[]): SchemaIssue[] {
  const pruned = pruneUnionNoise(errors);
  // zod emits a uuid as format + pattern, and a record key as propertyNames + a nested
  // pattern error: report each problem once, via the more specific line.
  const patternAt = new Set(pruned.filter((e) => e.keyword === "pattern").map((e) => e.instancePath));
  const seen = new Set<string>();
  const issues: SchemaIssue[] = [];
  for (const e of pruned) {
    if (e.keyword === "propertyNames") continue;
    if (e.keyword === "format" && patternAt.has(e.instancePath)) continue;
    let pointer = e.instancePath;
    let message = e.message ?? "is invalid";
    const params = e.params as Record<string, unknown>;
    switch (e.keyword) {
      case "required":
        message = `is missing required property "${String(params.missingProperty)}"`;
        break;
      case "additionalProperties":
        pointer = `${pointer}/${String(params.additionalProperty)}`;
        message = "is not allowed by the contract (unknown property)";
        break;
      case "enum":
        message = `must be one of: ${(params.allowedValues as unknown[]).map(String).join(", ")}`;
        break;
      case "const":
        message = `must be ${JSON.stringify(params.allowedValue)}`;
        break;
      case "pattern": {
        const pattern = String(params.pattern);
        message = pattern.startsWith(UUID_PATTERN_PREFIX)
          ? "must be a UUID"
          : pattern.startsWith(SEMVER_PATTERN_PREFIX)
            ? "must be a semantic version (x.y.z)"
            : `must match pattern "${pattern.length > PATTERN_ECHO_MAX ? `${pattern.slice(0, PATTERN_ECHO_MAX)}...` : pattern}"`;
        break;
      }
      default:
        break;
    }
    if (typeof e.propertyName === "string") message = `property name "${e.propertyName}" ${message}`;
    const line = `${pointer} ${message}`;
    if (seen.has(line)) continue;
    seen.add(line);
    issues.push({ pointer, message });
  }
  return issues;
}

// ── Platform capabilities ─────────────────────────────────────────────────────

/**
 * Base keys of the Workspace's built-in platform capabilities: the workspace's
 * own records, WorkQ, knowledge, artifacts and notifications surface. They are
 * served by in-process servers, so a package neither ships nor can redefine
 * them, and a process may list them in `capabilities[]` without bundling
 * anything. Mirror of PLATFORM_CAPABILITY_KEYS in myHubV2
 * packages/shared/src/process/platform-capabilities.ts: when the Workspace adds
 * one, add it here (agent-packages.test.ts pins the list).
 */
export const PLATFORM_CAPABILITY_KEYS: ReadonlySet<string> = new Set([
  "records.read",
  "records.write",
  "workq.create",
  "workq.update",
  "knowledge.read",
  "artifacts.write",
  "notifications.send",
]);

const PLATFORM_QUALIFIER_RE = /^[a-z0-9_.-]+$/;

/**
 * True for a platform capability key, qualified or not: `records.read` and
 * `records.read:client` are; `records.read:` (empty qualifier),
 * `email.send_reviewed` and `records.reads` are not. Same rule as the
 * Workspace's isPlatformCapabilityKey.
 */
export function isPlatformCapabilityKey(key: string): boolean {
  const separator = key.indexOf(":");
  if (separator === -1) return PLATFORM_CAPABILITY_KEYS.has(key);
  return PLATFORM_CAPABILITY_KEYS.has(key.slice(0, separator)) && PLATFORM_QUALIFIER_RE.test(key.slice(separator + 1));
}

// ── Process references ────────────────────────────────────────────────────────

export interface ProcessReferences {
  /** capability key → first place it is referenced (definition-relative JSON pointer). */
  capabilities: Map<string, string>;
  automations: Map<string, string>;
  forms: Map<string, string>;
  templates: Map<string, string>;
  /** `tests[]` — evaluation originKeys. */
  evaluations: Map<string, string>;
}

/**
 * Every cross-component reference a (schema-valid) process definition makes.
 * Defensive on purpose: a definition that failed the schema is skipped by the
 * caller, but nothing here may throw on odd input.
 *
 * Capability references: the declared `capabilities[]`, every decision option's
 * `intent.capability` and every `cancellation.compensation[].capability`.
 * (Platform capabilities are reported like any other key; the caller resolves
 * them with isPlatformCapabilityKey.)
 * `output.template` and `compensation[].template` are package resource NAMES,
 * not originKeys, so they are not references.
 */
export function collectProcessReferences(definition: unknown): ProcessReferences {
  const refs: ProcessReferences = {
    capabilities: new Map(),
    automations: new Map(),
    forms: new Map(),
    templates: new Map(),
    evaluations: new Map(),
  };
  if (!isRecord(definition)) return refs;
  const note = (into: Map<string, string>, key: unknown, pointer: string) => {
    if (typeof key === "string" && !into.has(key)) into.set(key, pointer);
  };

  if (Array.isArray(definition.capabilities)) {
    definition.capabilities.forEach((c, i) => note(refs.capabilities, c, `/capabilities/${i}`));
  }
  if (Array.isArray(definition.steps)) {
    definition.steps.forEach((step, i) => {
      if (!isRecord(step)) return;
      const at = `/steps/${i}`;
      switch (step.kind) {
        case "automation":
          note(refs.automations, step.automation, `${at}/automation`);
          break;
        case "human":
          note(refs.forms, step.form, `${at}/form`);
          note(refs.templates, step.template, `${at}/template`);
          break;
        case "external":
          note(refs.forms, step.form, `${at}/form`);
          break;
        case "decision":
          if (Array.isArray(step.options)) {
            step.options.forEach((option, j) => {
              if (isRecord(option) && isRecord(option.intent)) {
                note(refs.capabilities, option.intent.capability, `${at}/options/${j}/intent/capability`);
              }
            });
          }
          break;
        default:
          break;
      }
    });
  }
  if (isRecord(definition.cancellation) && Array.isArray(definition.cancellation.compensation)) {
    definition.cancellation.compensation.forEach((entry, i) => {
      if (isRecord(entry)) note(refs.capabilities, entry.capability, `/cancellation/compensation/${i}/capability`);
    });
  }
  if (Array.isArray(definition.tests)) {
    definition.tests.forEach((t, i) => note(refs.evaluations, t, `/tests/${i}`));
  }
  return refs;
}

// ── Step outputs and the references that read them ────────────────────────────
//
// A process expression reads `steps.<key>.<field>`. Whether <field> exists is
// not a question of shape, so the contract schema cannot ask it; these rules do.
// They are the marketplace copy of the Workspace's checks (myHubV2
// packages/shared/src/plugins/authoring/validate.ts: validateProcessReferences),
// over a COPY of its step-output model (packages/shared/src/process/step-outputs.ts
// - this repo cannot import the monorepo). Keep the two in step: when the
// coordinator changes what a step kind leaves behind, change STEP_KIND_OUTPUTS
// there, then here (agent-packages.test.ts pins the table).
//
// `steps.<key>` is built from the outputs of the latest FINISHED attempt of a
// step, and what counts is what the final write contains:
//   agent       the proposal: every declared `outputs` key, the optional `brief`,
//               and the `preparedBy` / `evidenceRefIds` the coordinator adds.
//               `proposalSchema` is a prompt hint: there is no `proposal` key.
//   automation  `ok`, `status`, `automationRunId` plus the NAMED outputs the run
//               produced - open, unless the automation is bundled and declares them.
//   human       `completed`, `accepted`, `completedBy`, `cancelled`; `formResponse` and `answers`
//               only when the step completes on a submitted form.
//   decision    `decision` (the chosen option's key - there is no `option`),
//               `responseId`, `answeredBy`, `onBehalfOf`, `revisionRequested`,
//               `transitionTo`, and `intents` (the outcome of each authorised action).
//   external    `requestId`, `requestRef`, then `responseId`, `source`, `choiceKey`,
//               `answer`, `formResponse`, `verifiedIdentity`, `confirmedBy`,
//               `evidenceRefIds`.
//   wait        `firedBy`, `firedAt`, `event`.
//   gate        `passed`, `outcome`, `missing`, `evidenceRefIds`.
//   output      `artifactId`, `version`, `fileName`, `title`, `evidenceRefIds`.

export const STEP_KINDS = ["agent", "automation", "human", "decision", "external", "wait", "gate", "output"] as const;
export type StepKind = (typeof STEP_KINDS)[number];

export interface StepKindOutputs {
  /** Names the runtime always writes for a step of this kind. */
  readonly runtime: readonly string[];
  /** The step's own declaration (agent `outputs`) adds names on top of `runtime`. */
  readonly declared: boolean;
  /** The runtime can add names the definition cannot list (an automation's named outputs). */
  readonly open: boolean;
}

export const STEP_KIND_OUTPUTS: Readonly<Record<StepKind, StepKindOutputs>> = {
  agent: { runtime: ["brief", "preparedBy", "evidenceRefIds"], declared: true, open: false },
  automation: { runtime: ["ok", "status", "automationRunId"], declared: false, open: true },
  human: { runtime: ["completed", "accepted", "cancelled", "completedBy"], declared: false, open: false },
  decision: {
    runtime: ["decision", "responseId", "answeredBy", "onBehalfOf", "revisionRequested", "transitionTo", "intents"],
    declared: false,
    open: false,
  },
  external: {
    runtime: [
      "requestId",
      "requestRef",
      "responseId",
      "source",
      "choiceKey",
      "answer",
      "formResponse",
      "verifiedIdentity",
      "confirmedBy",
      "evidenceRefIds",
    ],
    declared: false,
    open: false,
  },
  wait: { runtime: ["firedBy", "firedAt", "event"], declared: false, open: false },
  gate: { runtime: ["passed", "outcome", "missing", "evidenceRefIds"], declared: false, open: false },
  output: { runtime: ["artifactId", "version", "fileName", "title", "evidenceRefIds"], declared: false, open: false },
};

export interface StepOutputs {
  /** Every name known to be produced. */
  readonly fields: ReadonlySet<string>;
  /** More names may exist than `fields` lists - a name that is not in it proves nothing. */
  readonly open: boolean;
}

/** automation originKey -> the output names that automation declares, for the automations the caller can read. */
export type AutomationOutputs = ReadonlyMap<string, readonly string[]>;

function isStepKind(kind: unknown): kind is StepKind {
  return typeof kind === "string" && (STEP_KINDS as readonly string[]).includes(kind);
}

/** The names `steps.<step.key>.<name>` can resolve to after `step` finishes; null for something that is not a step. */
export function stepOutputsOf(step: unknown, automationOutputs?: AutomationOutputs): StepOutputs | null {
  if (!isRecord(step) || !isStepKind(step.kind)) return null;
  const model = STEP_KIND_OUTPUTS[step.kind];
  const fields = new Set<string>(model.runtime);
  let open = model.open;
  if (step.kind === "agent" && Array.isArray(step.outputs)) {
    for (const name of step.outputs) if (typeof name === "string") fields.add(name);
  } else if (step.kind === "automation") {
    const declared = typeof step.automation === "string" ? (automationOutputs?.get(step.automation) ?? []) : [];
    if (declared.length > 0) {
      for (const name of declared) fields.add(name);
      open = false;
    }
  } else if (step.kind === "human" && step.completion === "formSubmitted" && step.form !== undefined) {
    fields.add("formResponse");
    // The submitted answers, keyed by form field id (`steps.<key>.answers.<fieldId>`), written by the coordinator on settle.
    fields.add("answers");
  }
  return { fields, open };
}

/**
 * The output names a bundled automation payload declares: its Flow IR python
 * nodes' `outputs`, plus the `results` a foreach node adds. Empty when it
 * declares none or is not readable - its steps then stay open.
 */
export function declaredAutomationOutputs(payload: unknown): string[] {
  if (!isRecord(payload) || !isRecord(payload.flowIr) || !Array.isArray(payload.flowIr.nodes)) return [];
  const names = new Set<string>();
  for (const node of payload.flowIr.nodes as unknown[]) {
    if (!isRecord(node)) continue;
    if (node.kind === "foreach") names.add("results");
    if (!Array.isArray(node.outputs)) continue;
    for (const output of node.outputs as unknown[]) {
      if (isRecord(output) && typeof output.name === "string" && output.name.length > 0) names.add(output.name);
    }
  }
  return [...names];
}

export interface StepReference {
  /** The reference exactly as written. */
  readonly text: string;
  readonly stepKey: string;
  /** The first segment after the step key - the output name - or null for a bare `steps.<key>`. */
  readonly field: string | null;
  /** Segments after `field`. */
  readonly path: readonly string[];
}

export interface ExpressionReferences {
  readonly steps: readonly StepReference[];
  readonly inputs: ReadonlyArray<{ readonly text: string; readonly inputKey: string }>;
}

const WORD_START = /[A-Za-z_]/;
const WORD_PART = /[A-Za-z0-9_.-]/;

/**
 * Every `steps.*` and `inputs.*` reference in an expression of the coordinator's
 * language. Reads words as its tokenizer does (letters, digits, `_`, `.`, `-`; a
 * trailing `.` or `-` is not part of one) and, like it, never looks inside a
 * quoted string. Total: never throws.
 */
export function readReferences(expression: string): ExpressionReferences {
  const steps: StepReference[] = [];
  const inputs: Array<{ text: string; inputKey: string }> = [];
  let i = 0;
  while (i < expression.length) {
    const c = expression[i];
    if (c === "'" || c === '"') {
      i += 1;
      while (i < expression.length && expression[i] !== c) i += expression[i] === "\\" ? 2 : 1;
      i += 1;
      continue;
    }
    if (!WORD_START.test(c)) {
      i += 1;
      continue;
    }
    let j = i + 1;
    while (j < expression.length && WORD_PART.test(expression[j])) j += 1;
    let word = expression.slice(i, j);
    i = j;
    while (/[.-]$/.test(word)) word = word.slice(0, -1);
    const parts = word.split(".");
    if (parts.length < 2 || parts.some((part) => part === "")) continue;
    if (parts[0] === "steps") steps.push({ text: word, stepKey: parts[1], field: parts[2] ?? null, path: parts.slice(3) });
    else if (parts[0] === "inputs") inputs.push({ text: word, inputKey: parts[1] });
  }
  return { steps, inputs };
}

/**
 * The platform event types (`events/catalog.ts` EVENT_CATALOG in myHubV2
 * packages/shared): a process event trigger that names anything else never
 * fires. COPY - when the Workspace adds an event, add it here
 * (agent-packages.test.ts pins the count). Regenerate by listing the `type`
 * of every EVENT_CATALOG entry.
 */
export const PLATFORM_EVENT_TYPES: ReadonlySet<string> = new Set([
  "workq.item.created", "workq.item.updated", "workq.item.form_attached", "workq.item.status_changed",
  "workq.item.assigned", "workq.item.unassigned", "workq.item.claimed", "workq.item.completed",
  "workq.item.reopened", "workq.item.commented", "workq.item.deleted", "workq.item.due_soon",
  "workq.item.overdue", "workq.item.stale", "form.created", "form.published", "form.assignment_created",
  "form.response_started", "form.response_submitted", "form.response_reopened", "template.published",
  "playbook.applied", "user.created", "user.updated", "user.deactivated", "group.created",
  "group.member_added", "group.member_removed", "group.deleted", "client.created", "client.updated",
  "client.deleted", "opportunity.created", "opportunity.updated", "opportunity.stage_changed",
  "opportunity.won", "opportunity.lost", "opportunity.deleted", "contact.created", "contact.updated",
  "contact.deleted", "employee.assigned", "employee.unassigned", "portal.enabled", "portal.archived",
  "portal.reactivated", "portal.membership_added", "portal.membership_removed", "knowledge.file_created",
  "knowledge.file_updated", "knowledge.file_deleted", "knowledge.folder_created",
  "knowledge.folder_deleted", "connection.created", "connection.verified", "connection.failed",
  "connection.revoked", "connection.grant_added", "connection.grant_removed", "snapshot.refreshed",
  "snapshot.row_added", "snapshot.row_changed", "portal_report.created", "portal_report.updated",
  "portal_report.published", "artifact.created", "artifact.updated", "artifact.deleted",
  "artifact.shared", "automation.run_started", "automation.run_succeeded", "automation.run_failed",
  "automation.paused", "record.created", "record.updated", "record.stage_changed", "record.closed",
  "record.reopened", "record.deleted", "record.linked", "record.unlinked", "record.note_added",
  "records.type_published", "messaging.message.received", "process.run.started", "process.run.waiting",
  "process.run.resumed", "process.run.paused", "process.run.completed", "process.run.cancelled",
  "process.run.failed", "process.step.changed", "decision.requested", "decision.answered",
  "decision.invalidated", "decision.expired", "external_request.sent", "external_request.delivered",
  "external_request.answered", "external_request.expired", "action.authorised", "action.executed",
  "action.unknown", "action.failed",
]);

export const PROCESS_REFERENCE_ISSUE_CODES = [
  "unknown_output_reference",
  "unknown_materiality_key",
  "recipient_from_untrusted_output",
  "unknown_event_type",
  "unknown_step_reference",
  "unknown_input_reference",
] as const;
export type ProcessReferenceIssueCode = (typeof PROCESS_REFERENCE_ISSUE_CODES)[number];

export interface ProcessReferenceIssue {
  code: ProcessReferenceIssueCode;
  /** Definition-relative JSON pointer, e.g. `/transitions/3/when`. */
  pointer: string;
  message: string;
}

/** Step kinds whose output is somebody else's words: an agent's proposal, an outside party's reply. */
const UNTRUSTED_OUTPUT_KINDS: ReadonlySet<string> = new Set(["agent", "external"]);
/** Payload field names that choose who a message goes to. */
const RECIPIENT_FIELDS: ReadonlySet<string> = new Set(["to", "recipient", "recipients", "cc", "bcc"]);
/** Names a materiality entry may carry besides inputs and step outputs. */
const SPECIAL_MATERIALITY_KEYS: ReadonlySet<string> = new Set(["recipient", "evidenceVersions"]);

/** "A human step" / "An agent step". */
function withArticle(kind: string): string {
  return `${/^[aeiou]/.test(kind) ? "An" : "A"} ${kind}`;
}

function namesOf(names: Iterable<string>, limit = 12): string {
  const sorted = [...names].sort();
  return sorted.length > limit ? `${sorted.slice(0, limit).join(", ")}, …` : sorted.join(", ");
}

/** The "did you mean" tail of an unknown output, for the slips authors actually make. */
function outputHint(kind: string, field: string): string {
  if (kind === "decision" && field === "option") return " (the chosen option's key is `decision`)";
  if (kind === "agent" && field === "proposal") return " (the proposal is the step's outputs themselves; read a declared output)";
  if (kind === "human" && field === "form") return " (a submitted form is `formResponse`)";
  if (kind === "external" && field === "answered") return " (read `choiceKey` for a choice, `answer` for text)";
  return "";
}

/**
 * What a (schema-valid) process definition READS that does not exist, with the
 * same codes and messages as the Workspace's validateProcessReferences:
 *
 *   unknown_output_reference         `steps.<key>.<field>` the step's kind never produces
 *   unknown_materiality_key          a decision's materiality entry that is no input,
 *                                    `recipient`, `evidenceVersions` or step output
 *   recipient_from_untrusted_output  an external recipient, or a recipient field of an
 *                                    option payload, taken from an agent or external
 *                                    step's output (threat model AG-2 / AG-6)
 *   unknown_event_type               an event trigger the platform never emits
 *   unknown_step_reference /         the same typo in the expressions the contract
 *   unknown_input_reference          schema cannot check (gate `requires` included
 *                                    here: this repo has no other validator for them)
 *
 * Defensive on purpose: nothing here may throw on odd input.
 */
export function checkProcessReferences(
  definition: unknown,
  options: { automationOutputs?: AutomationOutputs } = {},
): ProcessReferenceIssue[] {
  const issues: ProcessReferenceIssue[] = [];
  if (!isRecord(definition)) return issues;
  const report = (code: ProcessReferenceIssueCode, pointer: string, message: string): void => {
    issues.push({ code, pointer, message });
  };

  const steps = Array.isArray(definition.steps) ? (definition.steps as unknown[]) : [];
  // First occurrence of a step key is canonical.
  const stepsByKey = new Map<string, Record<string, unknown>>();
  for (const step of steps) {
    if (isRecord(step) && typeof step.key === "string" && !stepsByKey.has(step.key)) stepsByKey.set(step.key, step);
  }
  const outputsByKey = new Map<string, StepOutputs>();
  for (const [key, step] of stepsByKey) {
    const outputs = stepOutputsOf(step, options.automationOutputs);
    if (outputs) outputsByKey.set(key, outputs);
  }
  const inputKeys = new Set<string>();
  if (Array.isArray(definition.inputs)) {
    for (const input of definition.inputs as unknown[]) if (isRecord(input) && typeof input.key === "string") inputKeys.add(input.key);
  }

  /** Is `field` something step `key` can leave behind? Unknown steps are not judged here. */
  const produces = (key: string, field: string): boolean => {
    const outputs = outputsByKey.get(key);
    return outputs === undefined || outputs.open || outputs.fields.has(field);
  };
  const unknownOutputMessage = (reference: string, step: Record<string, unknown>, field: string): string => {
    const outputs = outputsByKey.get(String(step.key))!;
    return `${reference} reads "${field}" from ${String(step.kind)} step "${String(step.key)}", which never produces it${outputHint(String(step.kind), field)}. ${withArticle(String(step.kind))} step here produces: ${namesOf(outputs.fields)}`;
  };

  interface Site {
    pointer: string;
    taint?: "recipient" | "payload";
  }
  const check = (expression: unknown, site: Site): void => {
    if (typeof expression !== "string") return;
    const references = readReferences(expression);
    for (const reference of references.steps) {
      const step = stepsByKey.get(reference.stepKey);
      if (step === undefined) {
        report("unknown_step_reference", site.pointer, `Expression references steps.${reference.stepKey}, but no step "${reference.stepKey}" exists`);
        continue;
      }
      if (reference.field !== null && outputsByKey.has(reference.stepKey) && !produces(reference.stepKey, reference.field)) {
        report("unknown_output_reference", site.pointer, unknownOutputMessage(reference.text, step, reference.field));
      }
      if (site.taint !== undefined && UNTRUSTED_OUTPUT_KINDS.has(String(step.kind))) {
        const names = reference.field === null ? [] : [reference.field, ...reference.path];
        if (site.taint === "recipient" || names.some((name) => RECIPIENT_FIELDS.has(name))) {
          report(
            "recipient_from_untrusted_output",
            site.pointer,
            `${reference.text} takes the recipient from the output of ${String(step.kind)} step "${String(step.key)}". Who a message goes to must come from the job's inputs or records, never from ${step.kind === "agent" ? "an agent's own words" : "an outside party's reply"} - an injected instruction could redirect it (threat model AG-2, AG-6)`,
          );
        }
      }
    }
    for (const reference of references.inputs) {
      if (!inputKeys.has(reference.inputKey)) {
        report("unknown_input_reference", site.pointer, `Expression references inputs.${reference.inputKey}, but no input "${reference.inputKey}" is declared`);
      }
    }
  };

  /** Materiality entries resolve like the coordinator's resolveMaterialValues: a bare name in facts, step outputs, then inputs; a dotted path from inputs. / facts. / steps. */
  const materialityProblem = (entry: string): string | null => {
    const usable = (): string =>
      `Use an input (${namesOf(inputKeys) || "none declared"}), \`recipient\`, \`evidenceVersions\`, or a steps.<key>.<output> path`;
    if (SPECIAL_MATERIALITY_KEYS.has(entry)) return null;
    if (!entry.includes(".")) {
      if (inputKeys.has(entry)) return null;
      // An automation's undeclared outputs are no evidence that a name exists: name those as steps.<key>.<output>.
      for (const outputs of outputsByKey.values()) if (outputs.fields.has(entry)) return null;
      return `Materiality key "${entry}" is not an input of this process and no step is known to produce a field of that name, so it would never change. ${usable()}`;
    }
    const [root, first, field] = entry.split(".");
    if (root === "facts") return null;
    if (root === "inputs") {
      return first !== undefined && inputKeys.has(first)
        ? null
        : `Materiality key "${entry}" names input "${first ?? ""}", which this process does not declare. ${usable()}`;
    }
    if (root === "steps") {
      const step = first === undefined ? undefined : stepsByKey.get(first);
      if (step === undefined) return `Materiality key "${entry}" names step "${first ?? ""}", which does not exist. ${usable()}`;
      if (field !== undefined && !produces(first!, field)) return `Materiality key ${unknownOutputMessage(`"${entry}"`, step, field)}`;
      return null;
    }
    return `Materiality key "${entry}" is a dotted path that does not start with inputs., facts. or steps., so it would never resolve. ${usable()}`;
  };

  steps.forEach((step, index) => {
    if (!isRecord(step)) return;
    const at = `/steps/${index}`;
    switch (step.kind) {
      case "automation":
        if (isRecord(step.inputs)) for (const [name, expression] of Object.entries(step.inputs)) check(expression, { pointer: `${at}/inputs/${name}` });
        break;
      case "external":
        check(step.recipient, { pointer: `${at}/recipient`, taint: "recipient" });
        break;
      case "wait":
        if (isRecord(step.timer)) check(step.timer.until, { pointer: `${at}/timer/until` });
        if (isRecord(step.event)) check(step.event.correlate, { pointer: `${at}/event/correlate` });
        break;
      case "gate":
        if (Array.isArray(step.requires)) step.requires.forEach((expression: unknown, i: number) => check(expression, { pointer: `${at}/requires/${i}` }));
        if (Array.isArray(step.evidence)) step.evidence.forEach((expression: unknown, i: number) => check(expression, { pointer: `${at}/evidence/${i}` }));
        break;
      case "decision":
        if (Array.isArray(step.options)) {
          step.options.forEach((option: unknown, i: number) => {
            if (isRecord(option) && isRecord(option.intent)) {
              check(option.intent.payloadFrom, { pointer: `${at}/options/${i}/intent/payloadFrom`, taint: "payload" });
            }
          });
        }
        if (Array.isArray(step.materiality)) {
          step.materiality.forEach((entry: unknown, i: number) => {
            if (typeof entry !== "string") return;
            const problem = materialityProblem(entry);
            if (problem !== null) report("unknown_materiality_key", `${at}/materiality/${i}`, problem);
          });
        }
        break;
      default:
        break;
    }
  });

  if (Array.isArray(definition.transitions)) {
    definition.transitions.forEach((transition: unknown, i: number) => {
      if (isRecord(transition)) check(transition.when, { pointer: `/transitions/${i}/when` });
    });
  }
  if (isRecord(definition.safeTest) && Array.isArray(definition.safeTest.assertions)) {
    definition.safeTest.assertions.forEach((expression: unknown, i: number) => check(expression, { pointer: `/safeTest/assertions/${i}` }));
  }
  if (Array.isArray(definition.triggers)) {
    definition.triggers.forEach((trigger: unknown, i: number) => {
      if (!isRecord(trigger) || trigger.kind !== "event" || typeof trigger.event !== "string" || PLATFORM_EVENT_TYPES.has(trigger.event)) return;
      const family = trigger.event.split(".")[0];
      const nearby = [...PLATFORM_EVENT_TYPES].filter((type) => type.startsWith(`${family}.`));
      report(
        "unknown_event_type",
        `/triggers/${i}/event`,
        `Event "${trigger.event}" is not in the platform event catalogue, so this trigger would never fire. ${
          nearby.length > 0 ? `Events starting "${family}.": ${namesOf(nearby, 10)}` : "See events/catalog.ts for the events the platform emits"
        }`,
      );
    });
  }
  return issues;
}

/**
 * A process reference the rules above refuse that no edit to the PACKAGE can fix:
 * the definition is the author's honest model of a thing the coordinator does not
 * do yet, so the repair is a product decision (change what the runtime exposes, or
 * redesign the process), not a rename. Like scripts/xxs-baseline.json these are
 * grandfathered FORWARD-ONLY: a listed (plugin, process, code, pointer) is
 * reported as a warning on every run instead of failing it; any other
 * occurrence - a new reference, or the same defect somewhere else - fails. An entry
 * the rules no longer raise is itself an error (delete it): a stale entry would
 * silently exempt whatever lands at that pointer next.
 */
export interface KnownReferenceGap {
  /** marketplace.json entry name. */
  plugin: string;
  /** originKey of the process payload. */
  process: string;
  code: ProcessReferenceIssueCode;
  /** Definition-relative JSON pointer of the offending expression. */
  pointer: string;
  /** Why editing the package cannot fix it. */
  reason: string;
}

const FORM_ANSWERS_NOT_OUTPUTS =
  "the follow-up form's answers (q_balanced, q_note) are not step outputs - a human step leaves only completed, accepted, completedBy and formResponse - so nothing the coordinator exposes can branch on the balance or carry the exception note; needs a decision: expose submitted form answers as step outputs, or make the outcome an explicit reviewer decision";

export const KNOWN_REFERENCE_GAPS: readonly KnownReferenceGap[] = [];

export interface KnownGapSplit {
  /** Issues no entry covers: these fail the run. */
  failures: ProcessReferenceIssue[];
  /** Issues an entry covers, with the entry: these are warnings. */
  known: Array<{ issue: ProcessReferenceIssue; gap: KnownReferenceGap }>;
  /** Entries for this process that matched nothing: these fail the run (delete them). */
  stale: KnownReferenceGap[];
}

/** Split the issues of one process payload into failures, grandfathered gaps and stale entries. */
export function splitKnownReferenceGaps(
  issues: readonly ProcessReferenceIssue[],
  plugin: string,
  processOriginKey: string | null,
  gaps: readonly KnownReferenceGap[] = KNOWN_REFERENCE_GAPS,
): KnownGapSplit {
  const mine = processOriginKey === null ? [] : gaps.filter((gap) => gap.plugin === plugin && gap.process === processOriginKey);
  const used = new Set<KnownReferenceGap>();
  const failures: ProcessReferenceIssue[] = [];
  const known: KnownGapSplit["known"] = [];
  for (const issue of issues) {
    const gap = mine.find((candidate) => candidate.code === issue.code && candidate.pointer === issue.pointer);
    if (gap) {
      used.add(gap);
      known.push({ issue, gap });
    } else {
      failures.push(issue);
    }
  }
  return { failures, known, stale: mine.filter((gap) => !used.has(gap)) };
}

// ── marketplace.json entry blocks ─────────────────────────────────────────────

const SETUP_EFFORTS = ["minutes", "an-hour", "half-day"];

function stringArrayIssue(name: string, value: unknown, maxItems: number, maxChars: number): string | null {
  if (!Array.isArray(value) || value.length > maxItems || value.some((v) => typeof v !== "string" || v.length > maxChars)) {
    return `${name} must be an array of at most ${maxItems} strings of at most ${maxChars} characters`;
  }
  return null;
}

/**
 * Shape of `listing.agent` (mirrors agentListingSchema in the Workspace's
 * marketplace-manifest.ts; unknown keys are refused). Messages start with the
 * field path so the caller can prefix its own location.
 */
export function validateAgentListingShape(agent: unknown): string[] {
  if (!isRecord(agent)) return ["listing.agent must be an object { role, outcomes, processes, requiredCapabilities, setupEffort?, priceDisplay?, usageDisplay? }"];
  const issues: string[] = [];
  const known = new Set(["role", "outcomes", "processes", "requiredCapabilities", "setupEffort", "priceDisplay", "usageDisplay"]);
  for (const key of Object.keys(agent)) {
    if (!known.has(key)) issues.push(`listing.agent.${key} is not a recognised field (allowed: ${[...known].join(", ")})`);
  }
  if (typeof agent.role !== "string" || agent.role.length > 120) {
    issues.push("listing.agent.role must be a string of at most 120 characters");
  }
  const lists: Array<[string, number, number]> = [
    ["outcomes", 8, 200],
    ["processes", 20, 80],
    ["requiredCapabilities", 40, 120],
  ];
  for (const [field, maxItems, maxChars] of lists) {
    const issue = stringArrayIssue(`listing.agent.${field}`, agent[field], maxItems, maxChars);
    if (issue) issues.push(issue);
  }
  if (agent.setupEffort !== undefined && !SETUP_EFFORTS.includes(agent.setupEffort as string)) {
    issues.push(`listing.agent.setupEffort must be one of: ${SETUP_EFFORTS.join(", ")}`);
  }
  for (const field of ["priceDisplay", "usageDisplay"] as const) {
    const value = agent[field];
    if (value !== undefined && (typeof value !== "string" || value.length > 200)) {
      issues.push(`listing.agent.${field} must be a string of at most 200 characters`);
    }
  }
  return issues;
}

/** Shape of the entry's `release` block (mirrors pluginReleaseSchema in the Workspace manifest). */
export function validateReleaseShape(release: unknown): string[] {
  if (!isRecord(release)) return ["release must be an object { candidate?, evidenceHash? }"];
  const issues: string[] = [];
  for (const key of Object.keys(release)) {
    if (key !== "candidate" && key !== "evidenceHash") issues.push(`release.${key} is not a recognised field (allowed: candidate, evidenceHash)`);
  }
  if (release.candidate !== undefined && typeof release.candidate !== "string") {
    issues.push("release.candidate must be a string");
  }
  if (release.evidenceHash !== undefined && (typeof release.evidenceHash !== "string" || !/^[0-9a-f]{64}$/.test(release.evidenceHash))) {
    issues.push("release.evidenceHash must be a lowercase sha256 hex digest");
  }
  return issues;
}

const WITHDRAWN_FIELDS = ["since", "reason", "alternative", "retireBy"];
const WITHDRAWN_REASON_MAX = 1000;
const WITHDRAWN_ALTERNATIVE_MAX = 200;
/** A plain date or a timestamp, with or without a zone: the two shapes ISO 8601 gives a withdrawal. */
const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:[.]\d{1,9})?)?(Z|[+-]\d{2}:\d{2})?)?$/;

/**
 * The instant (epoch ms) an ISO 8601 date or timestamp names, or null when the
 * value is not one: not a string, not that shape, or a day/hour that does not
 * exist (2026-02-30, 25:00). A timestamp without a zone is read as UTC, so the
 * comparison of two dates never depends on the machine running the validator.
 */
export function parseIsoDate(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = ISO_DATE_RE.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return null;
  if (match[4] !== undefined && (Number(match[4]) > 23 || Number(match[5]) > 59 || (match[6] !== undefined && Number(match[6]) > 59))) return null;
  const instant = Date.parse(match[4] !== undefined && match[7] === undefined ? `${value}Z` : value);
  return Number.isNaN(instant) ? null : instant;
}

/**
 * Shape of an entry's `withdrawn` block (mirrors pluginWithdrawnSchema in the
 * Workspace's marketplace-manifest.ts): a catalogue entry the maintainers have
 * taken off the shelf. `since` and `retireBy` are ISO 8601 dates and `retireBy`
 * must come after `since`; `reason` says why in words a manager can act on;
 * `alternative` names the package to move to, so it must be another plugin of
 * THIS registry. Stricter than the Workspace schema on three counts - dates
 * must be ISO (the schema accepts anything Date.parse reads), a blank reason is
 * refused, and unknown keys are refused like every other block here - because
 * this is where a malformed withdrawal is turned away (the Workspace ignores it).
 * Messages start with the field path so the caller can prefix its own location.
 */
export function validateWithdrawnShape(withdrawn: unknown, context: { name: string; pluginNames: ReadonlySet<string> }): string[] {
  if (!isRecord(withdrawn)) return ["withdrawn must be an object { since, reason, alternative?, retireBy? }"];
  const issues: string[] = [];
  for (const key of Object.keys(withdrawn)) {
    if (!WITHDRAWN_FIELDS.includes(key)) issues.push(`withdrawn.${key} is not a recognised field (allowed: ${WITHDRAWN_FIELDS.join(", ")})`);
  }
  const since = parseIsoDate(withdrawn.since);
  if (since === null) issues.push(`withdrawn.since must be an ISO 8601 date (2026-10-15) or timestamp (2026-10-15T09:30:00Z), got ${JSON.stringify(withdrawn.since)}`);
  if (typeof withdrawn.reason !== "string" || withdrawn.reason.trim().length === 0 || withdrawn.reason.length > WITHDRAWN_REASON_MAX) {
    issues.push(`withdrawn.reason must be a non-empty string of at most ${WITHDRAWN_REASON_MAX} characters: say why, in words the managers of existing installations can act on`);
  }
  if (withdrawn.alternative !== undefined) {
    const alternative = withdrawn.alternative;
    if (typeof alternative !== "string" || alternative.length === 0 || alternative.length > WITHDRAWN_ALTERNATIVE_MAX) {
      issues.push(`withdrawn.alternative must be a plugin name of at most ${WITHDRAWN_ALTERNATIVE_MAX} characters`);
    } else if (alternative === context.name) {
      issues.push(`withdrawn.alternative "${alternative}" is the plugin itself - name the package to move to instead`);
    } else if (!context.pluginNames.has(alternative)) {
      issues.push(`withdrawn.alternative "${alternative}" is not a plugin in this registry - it must match the name of another marketplace.json entry`);
    }
  }
  if (withdrawn.retireBy !== undefined) {
    const retireBy = parseIsoDate(withdrawn.retireBy);
    if (retireBy === null) {
      issues.push(`withdrawn.retireBy must be an ISO 8601 date (2026-12-15) or timestamp, got ${JSON.stringify(withdrawn.retireBy)}`);
    } else if (since !== null && retireBy <= since) {
      issues.push(`withdrawn.retireBy ${JSON.stringify(withdrawn.retireBy)} must be after withdrawn.since ${JSON.stringify(withdrawn.since)}`);
    }
  }
  return issues;
}

// ── dependencies[] ────────────────────────────────────────────────────────────

export const MAX_DEPENDENCIES = 20;

export interface DependencyEntry {
  name: string;
  dependencies?: unknown;
}

/** Elementary cycles found by a depth-first walk, each as [a, b, ..., a]. */
export function findDependencyCycles(graph: ReadonlyMap<string, readonly string[]>): string[][] {
  const state = new Map<string, 1 | 2>(); // absent = unvisited, 1 = on the current path, 2 = finished
  const stack: string[] = [];
  const cycles: string[][] = [];
  const visit = (node: string): void => {
    state.set(node, 1);
    stack.push(node);
    for (const next of graph.get(node) ?? []) {
      const s = state.get(next);
      if (s === 1) cycles.push([...stack.slice(stack.indexOf(next)), next]);
      else if (s === undefined) visit(next);
    }
    stack.pop();
    state.set(node, 2);
  };
  for (const node of graph.keys()) if (!state.has(node)) visit(node);
  return cycles;
}

/**
 * Shape, resolution and acyclicity of every entry's `dependencies[]`.
 * Each `{plugin, version}` must name ANOTHER plugin of this registry and carry
 * an exact/caret/tilde/x-range version. The range is NOT checked against the
 * dependency's current registry version: versions are rewritten per tier by
 * AI Studio (dev 0.0.x, main 1.x), so satisfaction is the publish-time
 * lockfile's job, not a static registry property.
 */
export function validateDependencies(entries: readonly DependencyEntry[]): string[] {
  const errors: string[] = [];
  const names = new Set(entries.map((e) => e.name));
  const graph = new Map<string, string[]>();

  for (const entry of entries) {
    if (entry.dependencies === undefined) continue;
    const where = `marketplace.json: plugin "${entry.name}"`;
    if (!Array.isArray(entry.dependencies)) {
      errors.push(`${where} dependencies must be an array of { plugin, version }`);
      continue;
    }
    if (entry.dependencies.length > MAX_DEPENDENCIES) {
      errors.push(`${where} dependencies lists ${entry.dependencies.length} plugins (max ${MAX_DEPENDENCIES})`);
    }
    const seen = new Set<string>();
    const edges: string[] = [];
    entry.dependencies.forEach((dep: unknown, i: number) => {
      const at = `${where} dependencies[${i}]`;
      if (!isRecord(dep)) {
        errors.push(`${at} must be an object { plugin, version }`);
        return;
      }
      for (const key of Object.keys(dep)) {
        if (key !== "plugin" && key !== "version") errors.push(`${at}.${key} is not a recognised field (allowed: plugin, version)`);
      }
      if (typeof dep.plugin !== "string" || dep.plugin.length === 0) {
        errors.push(`${at}.plugin must be a non-empty plugin name`);
      } else if (dep.plugin === entry.name) {
        errors.push(`${at}.plugin "${dep.plugin}" is the plugin itself — a plugin cannot depend on itself`);
      } else if (!names.has(dep.plugin)) {
        errors.push(`${at}.plugin "${dep.plugin}" is not a plugin in this registry — it must match the name of another marketplace.json entry`);
      } else if (seen.has(dep.plugin)) {
        errors.push(`${at}.plugin "${dep.plugin}" is listed more than once`);
      } else {
        seen.add(dep.plugin);
        edges.push(dep.plugin);
      }
      if (typeof dep.version !== "string" || !isSemverRange(dep.version)) {
        errors.push(`${at}.version ${JSON.stringify(dep.version)} is not a supported range — use ${RANGE_HINT}`);
      }
    });
    graph.set(entry.name, edges);
  }

  for (const cycle of findDependencyCycles(graph)) {
    errors.push(`marketplace.json: dependency cycle ${cycle.map((n) => `"${n}"`).join(" -> ")} — plugin dependencies must be acyclic`);
  }
  return errors;
}

// ── plugin.json ↔ marketplace.json version agreement ──────────────────────────

export interface VersionAgreementInput {
  /** marketplace.json entry name. */
  name: string;
  /** plugins/<dir> — for the message prefix. */
  dirName: string;
  entryVersion: unknown;
  pluginJsonVersion: unknown;
  isAgent: boolean;
}

/**
 * Agent packages (listing.agent): `version` must be strict semver and the two
 * files must agree — errors. Every other plugin: a disagreement is only a
 * WARNING, because `version` stays an opaque string for them and existing
 * entries already disagree.
 */
export function checkVersionAgreement(input: VersionAgreementInput): { errors: string[]; warnings: string[] } {
  const { name, dirName, entryVersion, pluginJsonVersion, isAgent } = input;
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isAgent) {
    if (typeof entryVersion === "string" && typeof pluginJsonVersion === "string" && entryVersion !== pluginJsonVersion) {
      warnings.push(
        `plugins/${dirName}: plugin.json version "${pluginJsonVersion}" does not match marketplace.json version "${entryVersion}" for plugin "${name}" (only a warning here; an error for agent packages)`,
      );
    }
    return { errors, warnings };
  }
  const where = `marketplace.json: plugin "${name}"`;
  if (typeof entryVersion !== "string" || entryVersion.length === 0) {
    errors.push(`${where} is an agent package (listing.agent) and must declare a version (strict semver, x.y.z with an optional prerelease)`);
  } else if (!isStrictSemver(entryVersion)) {
    errors.push(`${where} is an agent package and its version "${entryVersion}" is not strict semver (x.y.z with an optional prerelease)`);
  }
  if (typeof pluginJsonVersion !== "string" || pluginJsonVersion.length === 0) {
    errors.push(`plugins/${dirName}: agent package "${name}" must declare a version in plugin.json that matches marketplace.json`);
  } else if (typeof entryVersion === "string" && entryVersion !== pluginJsonVersion) {
    errors.push(
      `plugins/${dirName}: plugin.json version "${pluginJsonVersion}" does not match marketplace.json version "${entryVersion}" — agent packages must keep them equal`,
    );
  }
  return { errors, warnings };
}
