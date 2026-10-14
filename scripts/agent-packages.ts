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
