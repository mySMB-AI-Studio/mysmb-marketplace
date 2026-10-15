import { afterAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson } from "./extension-content";
import {
  checkProcessReferences,
  checkVersionAgreement,
  collectProcessReferences,
  contentHashOf,
  declaredAutomationOutputs,
  findDependencyCycles,
  isPlatformCapabilityKey,
  isSemverRange,
  isStrictSemver,
  KNOWN_REFERENCE_GAPS,
  loadStudioSchemaValidators,
  parseIsoDate,
  PLATFORM_CAPABILITY_KEYS,
  PLATFORM_EVENT_TYPES,
  readReferences,
  splitKnownReferenceGaps,
  STEP_KIND_OUTPUTS,
  STEP_KINDS,
  stepOutputsOf,
  StudioContractError,
  validateAgentListingShape,
  validateDependencies,
  validateReleaseShape,
  validateWithdrawnShape,
  type KnownReferenceGap,
  type ProcessReferenceIssue,
} from "./agent-packages";

const here = dirname(fileURLToPath(import.meta.url));
const scriptPath = join(here, "validate.ts");
const artefactPath = join(here, "..", "contracts", "studio-contracts-v1.json");

// ── Fixture content ───────────────────────────────────────────────────────────
// Definitions conform to contracts/studio-contracts-v1.json (the cases below
// that break them do so one rule at a time). UUIDs carry valid version/variant
// nibbles: the schema's uuid pattern is strict.

const ID = {
  process: "a1000000-0000-4000-8000-000000000001",
  evaluation: "a1000000-0000-4000-8000-000000000002",
  capability: "a1000000-0000-4000-8000-000000000003",
  automation: "a1000000-0000-4000-8000-000000000004",
  form: "a1000000-0000-4000-8000-000000000005",
  template: "a1000000-0000-4000-8000-000000000006",
  ghost: "a1000000-0000-4000-8000-0000000000ff",
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function processDefinition(): Record<string, any> {
  return {
    kind: "process",
    schemaVersion: 1,
    originKey: ID.process,
    key: "client-onboarding",
    version: "1.0.0",
    title: "New client onboarding",
    subject: { kind: "clients", dedupeBy: ["clientId"] },
    inputs: [{ key: "clientContact", type: "contact", required: true }],
    capabilities: ["email.send_reviewed"],
    roles: { reviewer: "installation.reviewer", lead: { group: "{{settings.deliveryGroup}}" } },
    variationPoints: [{ key: "reminderDays", type: "number", default: 2, min: 1, max: 10, editableBy: "manager" }],
    protectedRules: [{ key: "noInvitationWithoutDecision", description: "No invitation is sent until a reviewer approves." }],
    steps: [
      { key: "gather", kind: "agent", skill: "prepare-kickoff-plan", outputs: ["plan"] },
      { key: "check", kind: "automation", automation: ID.automation, inputs: { plan: "steps.gather.plan" } },
      {
        key: "approve", kind: "decision", type: "kickoff", eligible: ["reviewer"], materiality: ["clientContact"],
        options: [
          { key: "proceed", label: "Send invitation", effect: "Sends the kickoff invitation.", intent: { capability: "email.send_reviewed", payloadFrom: "steps.gather.plan.invitation" } },
          { key: "revise", label: "Ask for changes", effect: "Returns the plan to preparation.", transition: "gather" },
        ],
      },
      { key: "confirm", kind: "external", channel: ["email"], interaction: "form", recipient: "inputs.clientContact", identityLevel: "email_code", expiresAfterDays: 7, form: ID.form },
      { key: "handover", kind: "human", assign: "lead", template: ID.template, form: ID.form, completion: "formSubmitted" },
      { key: "done", kind: "gate", requires: ["steps.handover.accepted"], outcome: "handoverAccepted", evidence: ["steps.handover.formResponse"] },
    ],
    transitions: [
      { from: "gather", to: "check" },
      { from: "check", to: "approve", when: "steps.check.ok" },
      { from: "approve", to: "confirm" },
      { from: "confirm", to: "handover" },
      { from: "handover", to: "done" },
    ],
    exceptions: [],
    rework: [],
    cancellation: { compensation: [{ afterStep: "confirm", capability: "email.send_reviewed", template: "cancellationNotice" }] },
    outcomes: [{ key: "handoverAccepted", terminal: true, evidence: ["form_response"] }],
    tests: [ID.evaluation],
  };
}

function capabilityDefinition(): Record<string, any> {
  return {
    kind: "capability",
    schemaVersion: 1,
    originKey: ID.capability,
    key: "email.send_reviewed",
    title: "Send a reviewed email",
    sideEffectClass: "send",
    inputsSchema: { type: "object" },
    outputsSchema: { type: "object" },
    idempotency: { supported: true, keyParam: "client_request_id" },
    reconcile: { tool: "search_sent", by: "request_ref" },
    bindings: [{ server: "m365-mail-send", tool: "send_email", argMap: { to: "to" }, scopes: ["Mail.Send"] }],
    permissionRequirements: ["connectors:m365-mail-send"],
  };
}

function evaluationDefinition(): Record<string, any> {
  return {
    kind: "evaluation",
    schemaVersion: 1,
    originKey: ID.evaluation,
    key: "client-onboarding-core",
    title: "Core scenarios",
    process: ID.process,
    scenarios: [{ key: "happyPath", title: "Reviewer approves", inputs: {}, expected: { outcome: "handoverAccepted", decisions: [{ step: "approve", option: "proceed" }] } }],
    thresholds: { requiredScenarioPassRate: 1 },
    required: true,
  };
}

/** The payload the Workspace assembler writes: { kind, originKey, name, contentHash, definition }. */
function envelope(kind: string, definition: Record<string, any>, name = String(definition.title)) {
  const content = { kind, originKey: definition.originKey, name, definition };
  return { ...content, contentHash: createHash("sha256").update(canonicalJson(content)).digest("hex") };
}

// ── Registry fixtures ─────────────────────────────────────────────────────────

interface PluginFixture {
  name: string;
  /** marketplace.json entry fields beyond name/source. */
  entry?: Record<string, unknown>;
  /** plugin.json fields beyond name. */
  manifest?: Record<string, unknown>;
  /** plugin.json content section. */
  content?: Record<string, string[]>;
  /** plugin-relative path → JSON body. */
  files?: Record<string, unknown>;
}

const created: string[] = [];

function registry(plugins: PluginFixture[]): string {
  const root = mkdtempSync(join(tmpdir(), "mysmb-agent-validator-"));
  created.push(root);
  const json = (path: string, value: unknown) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(value));
  };
  json(join(root, ".claude-plugin", "marketplace.json"), {
    name: "test",
    plugins: plugins.map((p) => ({ name: p.name, source: `./plugins/${p.name}`, ...p.entry })),
  });
  for (const p of plugins) {
    const dir = join(root, "plugins", p.name);
    json(join(dir, ".claude-plugin", "plugin.json"), { name: p.name, ...p.manifest, ...(p.content ? { content: p.content } : {}) });
    json(join(dir, ".mcp.json"), { mcpServers: {} });
    writeFileSync(join(dir, "README.md"), `# ${p.name}\n\n## Configuration\nNone.\n`);
    for (const [path, body] of Object.entries(p.files ?? {})) json(join(dir, path), body);
  }
  return root;
}

function run(root: string): { ok: boolean; output: string } {
  const result = spawnSync(process.execPath, ["--import", "tsx", scriptPath, `--root=${root}`], { encoding: "utf8" });
  return { ok: result.status === 0, output: `${result.stdout}${result.stderr}` };
}

/** A capability provider: a plain supporting tool (no listing.agent) bundling email.send_reviewed. */
function capabilityProvider(name = "mail-capabilities"): PluginFixture {
  const path = `content/capabilities/${ID.capability}.json`;
  return {
    name,
    entry: { version: "1.2.0" },
    manifest: { version: "1.2.0" },
    content: { capabilities: [path] },
    files: { [path]: envelope("capability", capabilityDefinition()) },
  };
}

const PATHS = {
  process: `content/processes/${ID.process}.json`,
  evaluation: `content/evaluations/${ID.evaluation}.json`,
  automation: `content/automations/${ID.automation}.json`,
  form: `content/forms/${ID.form}.json`,
  template: `content/workq-templates/${ID.template}.json`,
};

/** A complete, valid agent package that depends on the capability provider. */
function agentPackage(overrides: Partial<PluginFixture> = {}): PluginFixture {
  return {
    name: "client-onboarding-agent",
    entry: {
      version: "1.0.0",
      dependencies: [{ plugin: "mail-capabilities", version: "^1.2.0" }],
      listing: {
        agent: {
          role: "Onboarding coordinator",
          outcomes: ["Handover accepted"],
          processes: ["client-onboarding"],
          requiredCapabilities: ["email.send_reviewed"],
          setupEffort: "an-hour",
        },
      },
    },
    manifest: { version: "1.0.0" },
    content: {
      processes: [PATHS.process],
      evaluations: [PATHS.evaluation],
      automations: [PATHS.automation],
      forms: [PATHS.form],
      workqTemplates: [PATHS.template],
    },
    files: {
      [PATHS.process]: envelope("process", processDefinition()),
      [PATHS.evaluation]: envelope("evaluation", evaluationDefinition()),
      [PATHS.automation]: { kind: "automation", originKey: ID.automation, flowIr: { irVersion: 1, nodes: [{ id: "check", kind: "python", outputs: [{ name: "ok", type: "bool" }] }] } },
      [PATHS.form]: { kind: "form", originKey: ID.form },
      [PATHS.template]: { kind: "workq_template", originKey: ID.template },
    },
    ...overrides,
  };
}

afterAll(() => {
  for (const root of created) {
    const within = relative(resolve(tmpdir()), resolve(root));
    if (!within || within.startsWith("..") || isAbsolute(within) || !within.startsWith("mysmb-agent-validator-")) {
      throw new Error("Unsafe fixture cleanup path");
    }
    rmSync(root, { recursive: true, force: true });
  }
});

// ── Unit tests (in-process) ───────────────────────────────────────────────────

describe("semver", () => {
  it("accepts strict versions and refuses everything else", () => {
    for (const ok of ["0.0.0", "1.2.3", "10.20.30", "1.0.0-rc.1", "1.0.0-alpha"]) expect(isStrictSemver(ok)).toBe(true);
    for (const bad of ["1", "1.2", "v1.2.3", "01.2.3", "1.2.3+build", "1.2.3.4", "", " 1.2.3", "^1.2.3"]) expect(isStrictSemver(bad)).toBe(false);
  });
  it("accepts exact, caret, tilde and x-ranges only", () => {
    for (const ok of ["1.2.3", "^1.2.3", "~1.2.3", "^0.0.1", "1.x", "1.*", "1.2.x", "1.2.X", "^1.0.0-rc.1"]) expect(isSemverRange(ok)).toBe(true);
    for (const bad of ["*", "x", "^1.2", "~1", ">=1.0.0", "1.0.0 - 2.0.0", "^1.0.0 || ^2.0.0", "latest", "", "1.2.3.4", "^v1.2.3"]) expect(isSemverRange(bad)).toBe(false);
  });
});

describe("dependencies", () => {
  const dep = (plugin: string, version = "^1.0.0") => ({ plugin, version });
  it("accepts a resolvable acyclic graph", () => {
    expect(validateDependencies([{ name: "a", dependencies: [dep("b"), dep("c", "~2.0.0")] }, { name: "b", dependencies: [dep("c", "1.x")] }, { name: "c" }])).toEqual([]);
  });
  it("reports shape, resolution, range, duplicate and self-dependency problems", () => {
    const messages = validateDependencies([
      { name: "a", dependencies: [dep("ghost"), dep("b", ">=1.0.0"), dep("b"), dep("a"), { plugin: "b", version: "^1.0.0", extra: true }, "b"] },
      { name: "b", dependencies: "nope" },
    ]).join("\n");
    expect(messages).toContain('dependencies[0].plugin "ghost" is not a plugin in this registry');
    expect(messages).toContain('dependencies[1].version ">=1.0.0" is not a supported range');
    expect(messages).toContain('dependencies[2].plugin "b" is listed more than once');
    expect(messages).toContain('dependencies[3].plugin "a" is the plugin itself');
    expect(messages).toContain("dependencies[4].extra is not a recognised field");
    expect(messages).toContain("dependencies[5] must be an object");
    expect(messages).toContain('plugin "b" dependencies must be an array');
  });
  it("rejects more than twenty dependencies", () => {
    const names = Array.from({ length: 21 }, (_, i) => `p${i}`);
    const messages = validateDependencies([{ name: "root", dependencies: names.map((n) => dep(n)) }, ...names.map((n) => ({ name: n }))]);
    expect(messages.join("\n")).toContain("dependencies lists 21 plugins (max 20)");
  });
  it("finds cycles, including longer ones, and reports each path", () => {
    expect(findDependencyCycles(new Map([["a", ["b"]], ["b", ["c"]], ["c", ["a"]]]))).toEqual([["a", "b", "c", "a"]]);
    expect(findDependencyCycles(new Map([["a", ["b"]], ["b", []]]))).toEqual([]);
    const messages = validateDependencies([{ name: "a", dependencies: [dep("b")] }, { name: "b", dependencies: [dep("a")] }]);
    expect(messages).toEqual(['marketplace.json: dependency cycle "a" -> "b" -> "a" — plugin dependencies must be acyclic']);
  });
});

describe("version agreement", () => {
  const base = { name: "x", dirName: "x" };
  it("is only a warning for ordinary plugins, and silent when they agree or one side is absent", () => {
    const mismatch = checkVersionAgreement({ ...base, entryVersion: "0.1.0", pluginJsonVersion: "0.2.0", isAgent: false });
    expect(mismatch.errors).toEqual([]);
    expect(mismatch.warnings).toHaveLength(1);
    expect(mismatch.warnings[0]).toContain('plugin.json version "0.2.0" does not match marketplace.json version "0.1.0"');
    expect(checkVersionAgreement({ ...base, entryVersion: "1.0.0", pluginJsonVersion: "1.0.0", isAgent: false })).toEqual({ errors: [], warnings: [] });
    expect(checkVersionAgreement({ ...base, entryVersion: "latest", pluginJsonVersion: undefined, isAgent: false })).toEqual({ errors: [], warnings: [] });
  });
  it("is an error for agent packages: strict semver, present in both files, equal", () => {
    expect(checkVersionAgreement({ ...base, entryVersion: "1.0.0", pluginJsonVersion: "1.0.0", isAgent: true })).toEqual({ errors: [], warnings: [] });
    expect(checkVersionAgreement({ ...base, entryVersion: "1.0", pluginJsonVersion: "1.0", isAgent: true }).errors.join("\n")).toContain('version "1.0" is not strict semver');
    expect(checkVersionAgreement({ ...base, entryVersion: undefined, pluginJsonVersion: "1.0.0", isAgent: true }).errors.join("\n")).toContain("must declare a version");
    expect(checkVersionAgreement({ ...base, entryVersion: "1.0.0", pluginJsonVersion: undefined, isAgent: true }).errors.join("\n")).toContain("must declare a version in plugin.json");
    const mismatch = checkVersionAgreement({ ...base, entryVersion: "1.0.0", pluginJsonVersion: "1.0.1", isAgent: true });
    expect(mismatch.warnings).toEqual([]);
    expect(mismatch.errors.join("\n")).toContain("agent packages must keep them equal");
  });
});

describe("listing.agent and release shapes", () => {
  const agent = { role: "Coordinator", outcomes: ["Done"], processes: ["p"], requiredCapabilities: ["c.x"] };
  it("accepts the documented shape and refuses unknown or oversized fields", () => {
    expect(validateAgentListingShape({ ...agent, setupEffort: "minutes", priceDisplay: "$99/mo", usageDisplay: "Metered" })).toEqual([]);
    expect(validateAgentListingShape("agent")[0]).toContain("listing.agent must be an object");
    expect(validateAgentListingShape({ ...agent, bogus: 1 }).join("\n")).toContain("listing.agent.bogus is not a recognised field");
    expect(validateAgentListingShape({ ...agent, role: "r".repeat(121) }).join("\n")).toContain("listing.agent.role");
    expect(validateAgentListingShape({ ...agent, outcomes: Array(9).fill("x") }).join("\n")).toContain("listing.agent.outcomes");
    expect(validateAgentListingShape({ ...agent, processes: [1] }).join("\n")).toContain("listing.agent.processes");
    expect(validateAgentListingShape({ ...agent, setupEffort: "forever" }).join("\n")).toContain("listing.agent.setupEffort");
    expect(validateAgentListingShape({ role: "r" }).join("\n")).toContain("listing.agent.outcomes");
  });
  it("validates the release block", () => {
    expect(validateReleaseShape({ candidate: "abc123", evidenceHash: "a".repeat(64) })).toEqual([]);
    expect(validateReleaseShape({ evidenceHash: "XYZ" }).join("\n")).toContain("release.evidenceHash");
    expect(validateReleaseShape({ other: 1 }).join("\n")).toContain("release.other is not a recognised field");
    expect(validateReleaseShape([])[0]).toContain("release must be an object");
  });
});

describe("platform capabilities", () => {
  it("pins the Workspace catalogue and accepts a qualifier only when it is well formed", () => {
    expect([...PLATFORM_CAPABILITY_KEYS].sort()).toEqual([
      "artifacts.write",
      "knowledge.read",
      "notifications.send",
      "records.read",
      "records.write",
      "workq.create",
      "workq.update",
    ]);
    for (const ok of ["records.read", "records.read:client", "workq.create", "artifacts.write", "records.read:records.client-v2"]) {
      expect(isPlatformCapabilityKey(ok)).toBe(true);
    }
    for (const bad of ["records.read:", "records.read:Client", "records.read:a:b", "records.reads", "email.send_reviewed", "crm.read:client", ":client", ""]) {
      expect(isPlatformCapabilityKey(bad)).toBe(false);
    }
  });
});

describe("process references", () => {
  it("collects capabilities from every place a process names one, plus the entities its steps use", () => {
    const refs = collectProcessReferences(processDefinition());
    expect([...refs.capabilities]).toEqual([
      ["email.send_reviewed", "/capabilities/0"],
    ]);
    const definition = processDefinition();
    definition.capabilities = [];
    const viaIntent = collectProcessReferences(definition).capabilities;
    expect(viaIntent.get("email.send_reviewed")).toBe("/steps/2/options/0/intent/capability");
    definition.steps[2].options[0].intent.capability = "crm.update";
    const all = collectProcessReferences(definition).capabilities;
    expect([...all.keys()].sort()).toEqual(["crm.update", "email.send_reviewed"]);
    expect(all.get("email.send_reviewed")).toBe("/cancellation/compensation/0/capability");
    expect(refs.automations.get(ID.automation)).toBe("/steps/1/automation");
    expect(refs.forms.get(ID.form)).toBe("/steps/3/form");
    expect(refs.templates.get(ID.template)).toBe("/steps/4/template");
    expect(refs.evaluations.get(ID.evaluation)).toBe("/tests/0");
  });
  it("does not throw on malformed input", () => {
    for (const input of [null, "x", 1, [], {}, { steps: "x", capabilities: 3, cancellation: [], tests: {} }, { steps: [null, 1, { kind: "decision", options: [null, { intent: 1 }] }] }]) {
      expect(() => collectProcessReferences(input)).not.toThrow();
    }
  });
});

describe("step outputs", () => {
  it("pins the model of what each step kind leaves behind (a copy of the Workspace's step-outputs.ts)", () => {
    expect(STEP_KINDS).toEqual(["agent", "automation", "human", "decision", "external", "wait", "gate", "output"]);
    expect(Object.fromEntries(STEP_KINDS.map((kind) => [kind, [...STEP_KIND_OUTPUTS[kind].runtime]]))).toEqual({
      agent: ["brief", "preparedBy", "evidenceRefIds"],
      automation: ["ok", "status", "automationRunId"],
      human: ["completed", "accepted", "cancelled", "completedBy"],
      decision: ["decision", "responseId", "answeredBy", "onBehalfOf", "revisionRequested", "transitionTo", "intents", "note"],
      external: ["requestId", "requestRef", "responseId", "source", "choiceKey", "answer", "formResponse", "verifiedIdentity", "confirmedBy", "evidenceRefIds"],
      wait: ["firedBy", "firedAt", "event"],
      gate: ["passed", "outcome", "missing", "evidenceRefIds"],
      output: ["artifactId", "version", "fileName", "title", "evidenceRefIds"],
    });
    expect(Object.fromEntries(STEP_KINDS.map((kind) => [kind, [STEP_KIND_OUTPUTS[kind].declared, STEP_KIND_OUTPUTS[kind].open]]))).toEqual({
      agent: [true, false],
      automation: [false, true],
      human: [false, false],
      decision: [false, false],
      external: [false, false],
      wait: [false, false],
      gate: [false, false],
      output: [false, false],
    });
  });
  it("lists the same step kinds as the contract artefact", () => {
    const badKind = processDefinition();
    badKind.steps[1].kind = "teleport";
    const [issue] = loadStudioSchemaValidators(artefactPath).validate("process", badKind);
    expect(issue.message).toBe(`must be one of: ${STEP_KINDS.join(", ")}`);
  });
  it("derives the readable names of a step from its kind and declaration", () => {
    const names = (step: unknown, automationOutputs?: Map<string, string[]>) => {
      const outputs = stepOutputsOf(step, automationOutputs);
      return outputs && { fields: [...outputs.fields].sort(), open: outputs.open };
    };
    expect(names({ kind: "agent", outputs: ["plan", "missing"], proposalSchema: "x" })).toEqual({ fields: ["brief", "evidenceRefIds", "missing", "plan", "preparedBy"], open: false });
    expect(names({ kind: "automation", automation: ID.automation })).toEqual({ fields: ["automationRunId", "ok", "status"], open: true });
    expect(names({ kind: "automation", automation: ID.automation }, new Map([[ID.automation, ["balanced"]]]))).toEqual({ fields: ["automationRunId", "balanced", "ok", "status"], open: false });
    expect(names({ kind: "automation", automation: ID.automation }, new Map([[ID.ghost, ["balanced"]]]))?.open).toBe(true);
    expect(names({ kind: "human", completion: "formSubmitted", form: ID.form })?.fields).toContain("formResponse");
    expect(names({ kind: "human", completion: "statusDone", form: ID.form })?.fields).not.toContain("formResponse");
    expect(names({ kind: "human", completion: "formSubmitted" })?.fields).not.toContain("formResponse");
    expect(names({ kind: "decision" })?.fields).toContain("decision");
    expect(names({ kind: "decision" })?.fields).not.toContain("option");
  });
  it("returns nothing for what is not a step, and never throws", () => {
    for (const input of [null, "x", 1, [], {}, { kind: "teleport" }, { kind: "agent", outputs: "plan" }, { kind: "automation", automation: 3 }]) {
      expect(() => stepOutputsOf(input)).not.toThrow();
    }
    expect(stepOutputsOf({ kind: "teleport" })).toBeNull();
    expect(stepOutputsOf(null)).toBeNull();
  });
  it("reads the steps and inputs an expression names, never inside a string", () => {
    const steps = (expression: string) => readReferences(expression).steps.map((ref) => [ref.stepKey, ref.field, ...ref.path].join("|"));
    expect(readReferences("steps.gather.plan.invitation.to").steps).toEqual([{ text: "steps.gather.plan.invitation.to", stepKey: "gather", field: "plan", path: ["invitation", "to"] }]);
    expect(steps("!steps.a.ok && (steps.b.x == 'y' || steps.c.z != null)")).toEqual(["a|ok", "b|x", "c|z"]);
    expect(steps("steps.a.x == 'steps.b.y'")).toEqual(["a|x"]);
    expect(steps('steps.a.x == "steps.b.y"')).toEqual(["a|x"]);
    expect(steps("steps.a.x == 'it\\'s steps.b.y'")).toEqual(["a|x"]);
    expect(steps("steps.a.intents.0.state == 'succeeded'")).toEqual(["a|intents|0|state"]);
    expect(steps("steps.a.ok.")).toEqual(["a|ok"]);
    expect(readReferences("steps.check != null").steps).toEqual([{ text: "steps.check", stepKey: "check", field: null, path: [] }]);
    expect(readReferences("inputs.clientContact.email != null").inputs).toEqual([{ text: "inputs.clientContact.email", inputKey: "clientContact" }]);
    expect(readReferences("facts.steps.a.b || mysteps.a.b || steps || steps..a.x").steps).toEqual([]);
    expect(() => readReferences("steps.a.x == 'unterminated")).not.toThrow();
  });
  it("reads the outputs a bundled automation declares (python nodes, plus a foreach's results)", () => {
    expect(declaredAutomationOutputs({ flowIr: { nodes: [{ kind: "python", outputs: [{ name: "balanced" }, { name: "difference" }] }, { kind: "foreach", items: "x" }, { kind: "if" }] } }).sort()).toEqual(["balanced", "difference", "results"]);
    expect(declaredAutomationOutputs({ kind: "automation", originKey: ID.automation })).toEqual([]);
    expect(declaredAutomationOutputs({ flowIr: { nodes: [{ kind: "python", outputs: [] }] } })).toEqual([]);
    for (const input of [null, "x", { flowIr: "x" }, { flowIr: { nodes: "x" } }, { flowIr: { nodes: [null, 1, { outputs: [null, { name: 3 }] }] } }]) {
      expect(() => declaredAutomationOutputs(input)).not.toThrow();
      expect(declaredAutomationOutputs(input)).toEqual([]);
    }
  });
});

describe("platform events", () => {
  it("pins the copy of the Workspace event catalogue", () => {
    expect(PLATFORM_EVENT_TYPES.size).toBe(104);
    for (const type of ["workq.item.created", "form.response_submitted", "client.created", "record.stage_changed", "process.run.completed", "decision.answered", "external_request.answered", "action.unknown"]) {
      expect(PLATFORM_EVENT_TYPES.has(type), type).toBe(true);
    }
    for (const type of PLATFORM_EVENT_TYPES) expect(type).toMatch(/^[a-z][a-z0-9_]*(?:\.[a-z0-9_]+)+$/);
  });
});

describe("process reference rules", () => {
  const where = (issues: ReadonlyArray<{ code: string; pointer: string }>) => issues.map((issue) => `${issue.code} @ ${issue.pointer}`);
  /** The fixture process (gather 0, check 1, approve 2, confirm 3, handover 4, done 5) with one more transition reading `expression`. */
  const readIn = (expression: string, options?: Parameters<typeof checkProcessReferences>[1]) => {
    const definition = processDefinition();
    definition.transitions.push({ from: "done", to: "gather", when: expression });
    return checkProcessReferences(definition, options);
  };
  const withEdit = (edit: (definition: Record<string, any>) => void, options?: Parameters<typeof checkProcessReferences>[1]) => {
    const definition = processDefinition();
    edit(definition);
    return checkProcessReferences(definition, options);
  };

  it("accepts the fixture process, and a closed automation that declares what the process reads", () => {
    expect(checkProcessReferences(processDefinition())).toEqual([]);
    expect(checkProcessReferences(processDefinition(), { automationOutputs: new Map([[ID.automation, ["ok"]]]) })).toEqual([]);
  });

  describe("unknown_output_reference", () => {
    it.each([
      ["a transition condition", (d: Record<string, any>) => { d.transitions[3].when = "steps.confirm.answered"; }, "/transitions/3/when"],
      ["a gate requirement", (d: Record<string, any>) => { d.steps[5].requires = ["steps.handover.form"]; }, "/steps/5/requires/0"],
      ["gate evidence", (d: Record<string, any>) => { d.steps[5].evidence = ["steps.handover.notes"]; }, "/steps/5/evidence/0"],
      ["an option payload", (d: Record<string, any>) => { d.steps[2].options[0].intent.payloadFrom = "steps.gather.proposal"; }, "/steps/2/options/0/intent/payloadFrom"],
      ["an external recipient", (d: Record<string, any>) => { d.steps[3].recipient = "steps.approve.option"; }, "/steps/3/recipient"],
      ["an automation input", (d: Record<string, any>) => { d.steps[1].inputs = { plan: "steps.gather.plans" }; }, "/steps/1/inputs/plan"],
      ["a wait timer", (d: Record<string, any>) => { d.steps.push({ key: "pause", kind: "wait", timer: { until: "steps.confirm.replyDate" } }); }, "/steps/6/timer/until"],
      ["a wait correlation", (d: Record<string, any>) => { d.steps.push({ key: "pause", kind: "wait", event: { eventType: "email.reply_received", correlate: "steps.confirm.threadId" } }); }, "/steps/6/event/correlate"],
      ["a safe-test assertion", (d: Record<string, any>) => { d.safeTest = { sampleInputs: {}, assertions: ["steps.gather.nope != null"] }; }, "/safeTest/assertions/0"],
    ])("is raised for %s", (_label, edit, pointer) => {
      expect(where(withEdit(edit))).toEqual([`unknown_output_reference @ ${pointer}`]);
    });

    it("catches the confirm.answered defect, naming what an external step does produce", () => {
      const [issue] = withEdit((d) => { d.transitions[3].when = "steps.confirm.answered"; });
      expect(issue.message).toContain('steps.confirm.answered reads "answered" from external step "confirm", which never produces it');
      expect(issue.message).toContain("`choiceKey`");
      expect(issue.message).toMatch(/produces: .*choiceKey.*verifiedIdentity/);
      expect(withEdit((d) => { d.transitions[3].when = "steps.confirm.choiceKey == 'confirm'"; })).toEqual([]);
    });

    it("points a decision's .option at .decision", () => {
      const [issue] = readIn("steps.approve.option != 'revise'");
      expect(issue.message).toContain("`decision`");
      expect(readIn("steps.approve.decision != 'revise'")).toEqual([]);
    });

    it.each([
      ["gather", ["plan", "brief", "preparedBy"], ["proposal", "planz"]],
      ["handover", ["accepted", "completed", "completedBy", "cancelled", "formResponse", "answers"], ["form"]],
      ["approve", ["decision", "responseId", "intents"], ["option", "optionKey"]],
      ["confirm", ["choiceKey", "answer", "responseId", "verifiedIdentity"], ["answered", "threadId"]],
      ["done", ["passed", "outcome", "missing"], ["result"]],
    ])("%s: reads %j, refuses %j", (key, good, bad) => {
      for (const field of good) expect(readIn(`steps.${key}.${field} != null`), `${key}.${field}`).toEqual([]);
      for (const field of bad) expect(where(readIn(`steps.${key}.${field} != null`)), `${key}.${field}`).toEqual(["unknown_output_reference @ /transitions/5/when"]);
    });

    it("judges only the output name, lets a bare steps.<key> through, and never reads inside a string", () => {
      expect(readIn("steps.gather.plan.invitation.to != null")).toEqual([]);
      expect(readIn("steps.approve.intents.0.state == 'succeeded'")).toEqual([]);
      expect(readIn("steps.check != null")).toEqual([]);
      expect(readIn("steps.approve.decision == 'steps.nobody.nothing'")).toEqual([]);
    });

    it("treats an automation as open until the bundle says what it declares", () => {
      expect(readIn("steps.check.balanced && steps.check.ok")).toEqual([]);
      const declared = { automationOutputs: new Map([[ID.automation, ["balanced"]]]) };
      expect(readIn("steps.check.balanced && steps.check.ok && steps.check.status", declared)).toEqual([]);
      expect(where(readIn("steps.check.difference", declared))).toEqual(["unknown_output_reference @ /transitions/5/when"]);
    });

    it("gives a human step formResponse only when it completes on a submitted form", () => {
      const statusDone = withEdit((d) => { d.steps[4].completion = "statusDone"; });
      expect(where(statusDone)).toEqual(["unknown_output_reference @ /steps/5/evidence/0"]);
    });
  });

  describe("unknown_step_reference and unknown_input_reference", () => {
    it("catch a typo in any expression, gate requirements included", () => {
      expect(where(readIn("steps.confrim.choiceKey"))).toEqual(["unknown_step_reference @ /transitions/5/when"]);
      expect(where(readIn("inputs.clientContcat != null"))).toEqual(["unknown_input_reference @ /transitions/5/when"]);
      expect(where(withEdit((d) => { d.steps[5].requires = ["steps.ghost.ok", "inputs.ghost"]; }))).toEqual([
        "unknown_step_reference @ /steps/5/requires/0",
        "unknown_input_reference @ /steps/5/requires/1",
      ]);
    });
  });

  describe("automation inputs: {{placeholders}} and expressions", () => {
    it("accepts a setup placeholder and a declared variation point beside an expression", () => {
      expect(where(withEdit((d) => { d.steps[1].inputs = { plan: "steps.gather.plan", days: "{{reminderDays}}", group: "{{settings.deliveryGroup}}" }; }))).toEqual([]);
    });

    it("flags a bare placeholder that names no variation point, and a placeholder mixed into an expression", () => {
      expect(where(withEdit((d) => { d.steps[1].inputs = { days: "{{reminderDay}}", mixed: "{{reminderDays}} > 1" }; }))).toEqual([
        "unknown_variation_point @ /steps/1/inputs/days",
        "invalid_expression @ /steps/1/inputs/mixed",
      ]);
    });
  });

  describe("unknown_materiality_key", () => {
    const closed = { automationOutputs: new Map([[ID.automation, ["ok"]]]) };
    const materiality = (...entries: string[]) => withEdit((d) => { d.steps[2].materiality = entries; }, closed);

    it.each(["recipient", "evidenceVersions", "clientContact", "plan", "ok", "inputs.clientContact", "inputs.clientContact.email", "facts.scopeVersion", "steps.gather.plan", "steps.gather.plan.amount", "steps.confirm.choiceKey", "steps.gather"])(
      "accepts %s",
      (entry) => {
        expect(materiality(entry)).toEqual([]);
      },
    );

    it("refuses a bare name that is no input and that no step produces (the kickoffDate defect)", () => {
      const issues = materiality("recipient", "kickoffDate");
      expect(where(issues)).toEqual(["unknown_materiality_key @ /steps/2/materiality/1"]);
      expect(issues[0].message).toContain('Materiality key "kickoffDate" is not an input of this process');
      expect(issues[0].message).toContain("clientContact");
      expect(issues[0].message).toContain("`recipient`");
    });

    it.each([
      ["inputs.kickoffDate", /names input "kickoffDate", which this process does not declare/],
      ["steps.ghost.plan", /names step "ghost", which does not exist/],
      ["steps.gather.planz", /reads "planz" from agent step "gather", which never produces it/],
      ["steps.approve.option", /reads "option" from decision step "approve".*`decision`/],
      ["plan.amount", /does not start with inputs\., facts\. or steps\./],
    ])("refuses %s", (entry, message) => {
      const issues = materiality(entry);
      expect(where(issues)).toEqual(["unknown_materiality_key @ /steps/2/materiality/0"]);
      expect(issues[0].message).toMatch(message);
    });

    it("takes an automation that declares nothing as no evidence of a bare name: name its outputs as steps.<key>.<output>", () => {
      const open = (entry: string) => withEdit((d) => { d.steps[2].materiality = [entry]; });
      expect(where(open("kickoffDate"))).toEqual(["unknown_materiality_key @ /steps/2/materiality/0"]);
      expect(open("kickoffDate")[0].message).toContain("no step is known to produce a field of that name");
      expect(open("steps.check.kickoffDate")).toEqual([]);
      expect(where(open("inputs.kickoffDate"))).toEqual(["unknown_materiality_key @ /steps/2/materiality/0"]);
    });
  });

  describe("recipient_from_untrusted_output", () => {
    const withContact = (edit: (definition: Record<string, any>) => void) =>
      withEdit((d) => {
        d.steps[0].outputs = ["plan", "contact", "recipient"];
        edit(d);
      });

    it.each([
      ["an agent output", "steps.gather.contact"],
      ["a field of an agent output", "steps.gather.plan.recipient"],
      ["an outside party's reply", "steps.confirm.answer"],
    ])("refuses an external recipient taken from %s", (_label, recipient) => {
      const issues = withContact((d) => { d.steps[3].recipient = recipient; });
      expect(where(issues)).toEqual(["recipient_from_untrusted_output @ /steps/3/recipient"]);
      expect(issues[0].message).toContain(recipient);
      expect(issues[0].message).toContain("AG-2");
    });

    it("accepts a recipient from an input, a literal, or a step that is not somebody else's words", () => {
      for (const recipient of ["inputs.clientContact", "inputs.clientContact.email", "'client@example.test'", "steps.approve.decision", "steps.handover.completedBy", "steps.check.contact"]) {
        const issues = withContact((d) => { d.steps[3].recipient = recipient; });
        expect(issues.filter((issue) => issue.code === "recipient_from_untrusted_output"), recipient).toEqual([]);
      }
    });

    it.each(["steps.gather.plan.to", "steps.gather.plan.invitation.cc", "steps.gather.plan.bcc", "steps.gather.plan.recipients.0", "steps.confirm.answer.to", "steps.gather.recipient"])(
      "refuses an option payload that reaches for a recipient field of %s",
      (payloadFrom) => {
        const issues = withContact((d) => { d.steps[2].options[0].intent.payloadFrom = payloadFrom; });
        expect(where(issues)).toEqual(["recipient_from_untrusted_output @ /steps/2/options/0/intent/payloadFrom"]);
      },
    );

    it("leaves a payload that is not a recipient field alone: the whole payload is not decidable here", () => {
      expect(withContact(() => undefined)).toEqual([]);
      for (const payloadFrom of ["steps.gather.plan.invitation", "inputs.clientContact.to", "steps.check.to", "steps.approve.decision"]) {
        const issues = withContact((d) => { d.steps[2].options[0].intent.payloadFrom = payloadFrom; });
        expect(issues.filter((issue) => issue.code === "recipient_from_untrusted_output"), payloadFrom).toEqual([]);
      }
    });
  });

  describe("unknown_event_type", () => {
    const withTrigger = (event: string) => withEdit((d) => { d.triggers = [{ kind: "event", event, inputsFrom: { clientContact: "subject.name" } }]; });

    it("accepts a catalogued event and refuses one the platform never emits, naming its family", () => {
      expect(withTrigger("workq.item.created")).toEqual([]);
      const issues = withTrigger("client.registered");
      expect(where(issues)).toEqual(["unknown_event_type @ /triggers/0/event"]);
      expect(issues[0].message).toContain('"client.registered"');
      expect(issues[0].message).toContain("client.created");
      expect(withTrigger("zzz.thing")[0].message).toContain("events/catalog.ts");
    });

    it("leaves schedule triggers alone and judges every event trigger", () => {
      const issues = withEdit((d) => {
        d.triggers = [
          { kind: "schedule", cron: "0 9 * * 1", inputs: { clientContact: "weekly" } },
          { kind: "event", event: "workq.item.created", inputsFrom: { clientContact: "subject.title" } },
          { kind: "event", event: "client.registered", inputsFrom: { clientContact: "subject.name" } },
        ];
      });
      expect(where(issues)).toEqual(["unknown_event_type @ /triggers/2/event"]);
    });
  });

  it("is total: odd input never throws", () => {
    for (const input of [null, "x", 1, [], {}, { steps: "x", transitions: 3, inputs: {}, triggers: "x", safeTest: [] }, { steps: [null, 1, { kind: "decision", materiality: [1, null], options: [null, { intent: 1 }] }, { kind: "external", recipient: 3 }, { kind: "gate", requires: "x" }], transitions: [null, { when: 4 }] }]) {
      expect(() => checkProcessReferences(input)).not.toThrow();
    }
  });
});

describe("known reference gaps", () => {
  const issue = (pointer: string, code: ProcessReferenceIssue["code"] = "unknown_output_reference"): ProcessReferenceIssue => ({ code, pointer, message: "m" });
  const gap = (pointer: string): KnownReferenceGap => ({ plugin: "p", process: "o", code: "unknown_output_reference", pointer, reason: "r" });

  it("grandfathers exactly the listed (plugin, process, code, pointer) and fails everything else", () => {
    const split = splitKnownReferenceGaps(
      [issue("/a"), issue("/b"), issue("/a", "unknown_materiality_key")],
      "p",
      "o",
      [gap("/a")],
    );
    expect(split.known.map((k) => k.issue.pointer)).toEqual(["/a"]);
    expect(split.failures.map((f) => `${f.code} ${f.pointer}`)).toEqual(["unknown_output_reference /b", "unknown_materiality_key /a"]);
    expect(split.stale).toEqual([]);
  });
  it("applies an entry only to its own plugin and process", () => {
    for (const [plugin, process] of [["other", "o"], ["p", "other"], ["p", null]] as const) {
      const split = splitKnownReferenceGaps([issue("/a")], plugin, process, [gap("/a")]);
      expect(split.known).toEqual([]);
      expect(split.failures).toHaveLength(1);
      expect(split.stale).toEqual([]);
    }
  });
  it("reports an entry the rules no longer raise as stale, so it cannot exempt what lands there next", () => {
    const split = splitKnownReferenceGaps([issue("/a")], "p", "o", [gap("/a"), gap("/fixed")]);
    expect(split.stale.map((g) => g.pointer)).toEqual(["/fixed"]);
    expect(splitKnownReferenceGaps([], "p", "o", [gap("/fixed")]).stale).toHaveLength(1);
  });
  it("ships no grandfathered gaps: the reference packages pass every reference rule", () => {
    expect(KNOWN_REFERENCE_GAPS).toEqual([]);
  });
});

describe("the reference packages", () => {
  const pluginsDir = join(here, "..", "plugins");
  it.each([
    ["client-onboarding", 1],
    ["bookkeeper", 1],
    ["marketing", 1],
    ["sales", 3],
  ] as const)("%s reads only outputs its steps produce (bar the grandfathered gaps)", (name, processCount) => {
    const dir = join(pluginsDir, name);
    const read = (path: string) => JSON.parse(readFileSync(join(dir, path), "utf8")) as Record<string, any>;
    const content = read(join(".claude-plugin", "plugin.json")).content as Record<string, string[]>;
    const automationOutputs = new Map<string, string[]>();
    for (const path of content.automations ?? []) {
      const payload = read(path);
      const names = declaredAutomationOutputs(payload);
      if (names.length > 0) automationOutputs.set(payload.originKey, names);
    }
    expect(content.processes).toHaveLength(processCount);
    for (const path of content.processes) {
      const payload = read(path);
      const split = splitKnownReferenceGaps(checkProcessReferences(payload.definition, { automationOutputs }), name, payload.originKey);
      expect(split.failures.map((f) => `${f.code} ${f.pointer}: ${f.message}`)).toEqual([]);
      expect(split.stale).toEqual([]);
      expect(contentHashOf(payload)).toBe(payload.contentHash);
    }
  });
});

describe("withdrawn block", () => {
  const context = { name: "old", pluginNames: new Set(["old", "new"]) };
  const issues = (withdrawn: unknown) => validateWithdrawnShape(withdrawn, context);

  it("reads ISO 8601 dates and timestamps and nothing else", () => {
    expect(parseIsoDate("2026-10-15")).toBe(Date.UTC(2026, 9, 15));
    expect(parseIsoDate("2026-10-15T09:30:00Z")).toBe(Date.UTC(2026, 9, 15, 9, 30));
    expect(parseIsoDate("2026-10-15T09:30:00.123+10:00")).toBe(Date.UTC(2026, 9, 14, 23, 30, 0, 123));
    // No zone: UTC, so the answer never depends on the machine.
    expect(parseIsoDate("2026-10-15T09:30")).toBe(Date.UTC(2026, 9, 15, 9, 30));
    for (const bad of ["", "2026-10", "20261015", "15/10/2026", "Oct 15 2026", "yesterday", "2026-02-30", "2026-13-01", "2026-10-15T25:00:00Z", "2026-10-15T10:61:00Z", "2026-10-15 09:30:00Z", 20261015, null, undefined]) {
      expect(parseIsoDate(bad), String(bad)).toBeNull();
    }
  });

  it("accepts the documented shape, with or without the optional fields", () => {
    expect(issues({ since: "2026-10-01", reason: "Replaced by the new package." })).toEqual([]);
    expect(issues({ since: "2026-10-01T09:00:00Z", reason: "r", alternative: "new", retireBy: "2026-12-01" })).toEqual([]);
    expect(issues({ since: "2026-10-01", reason: "r".repeat(1000) })).toEqual([]);
  });

  it("refuses what is not an object, unknown keys, and a missing or malformed since and reason", () => {
    for (const bad of ["yes", null, [], 1]) expect(issues(bad)[0]).toContain("withdrawn must be an object");
    expect(issues({ since: "2026-10-01", reason: "r", note: 1 }).join("\n")).toContain("withdrawn.note is not a recognised field (allowed: since, reason, alternative, retireBy)");
    expect(issues({ reason: "r" }).join("\n")).toContain("withdrawn.since must be an ISO 8601 date");
    expect(issues({ since: "yesterday", reason: "r" }).join("\n")).toContain('withdrawn.since must be an ISO 8601 date (2026-10-15) or timestamp (2026-10-15T09:30:00Z), got "yesterday"');
    expect(issues({ since: "2026-10-01" }).join("\n")).toContain("withdrawn.reason must be a non-empty string");
    expect(issues({ since: "2026-10-01", reason: "  " }).join("\n")).toContain("withdrawn.reason must be a non-empty string");
    expect(issues({ since: "2026-10-01", reason: "r".repeat(1001) }).join("\n")).toContain("withdrawn.reason");
  });

  it("requires the alternative to be another plugin of this registry", () => {
    expect(issues({ since: "2026-10-01", reason: "r", alternative: "ghost" }).join("\n")).toContain('withdrawn.alternative "ghost" is not a plugin in this registry');
    expect(issues({ since: "2026-10-01", reason: "r", alternative: "old" }).join("\n")).toContain('withdrawn.alternative "old" is the plugin itself');
    expect(issues({ since: "2026-10-01", reason: "r", alternative: "" }).join("\n")).toContain("withdrawn.alternative must be a plugin name");
    expect(issues({ since: "2026-10-01", reason: "r", alternative: 3 }).join("\n")).toContain("withdrawn.alternative must be a plugin name");
  });

  it("requires retireBy to be a date after since", () => {
    expect(issues({ since: "2026-10-01", reason: "r", retireBy: "2026-10-01" }).join("\n")).toContain('withdrawn.retireBy "2026-10-01" must be after withdrawn.since "2026-10-01"');
    expect(issues({ since: "2026-10-01", reason: "r", retireBy: "2026-09-01" }).join("\n")).toContain("must be after withdrawn.since");
    expect(issues({ since: "2026-10-01", reason: "r", retireBy: "soon" }).join("\n")).toContain("withdrawn.retireBy must be an ISO 8601 date");
    expect(issues({ since: "2026-10-01", reason: "r", retireBy: "2026-10-01T00:00:01Z" })).toEqual([]);
    // A bad since is reported once; retireBy is not compared against it.
    expect(issues({ since: "never", reason: "r", retireBy: "2026-09-01" })).toHaveLength(1);
  });
});

describe("Studio contract artefact", () => {
  const validators = loadStudioSchemaValidators(artefactPath);
  const messages = (kind: "process" | "capability" | "evaluation", definition: unknown) =>
    validators.validate(kind, definition).map((issue) => `${issue.pointer} ${issue.message}`);

  it("accepts conforming definitions", () => {
    expect(messages("process", processDefinition())).toEqual([]);
    expect(messages("capability", capabilityDefinition())).toEqual([]);
    expect(messages("evaluation", evaluationDefinition())).toEqual([]);
  });
  it("reports each error with its JSON-pointer instance path, collapsing union noise to one useful line", () => {
    const missing = processDefinition();
    delete missing.steps[0].skill;
    expect(messages("process", missing)).toEqual(['/steps/0 is missing required property "skill"']);

    const badKind = processDefinition();
    badKind.steps[1].kind = "teleport";
    expect(messages("process", badKind)).toEqual(["/steps/1/kind must be one of: agent, automation, human, decision, external, wait, gate, output"]);

    const extra = processDefinition();
    extra.steps[0].bogus = true;
    expect(messages("process", extra)).toEqual(["/steps/0/bogus is not allowed by the contract (unknown property)"]);

    const badBinding = processDefinition();
    badBinding.roles.reviewer = "someone";
    expect(messages("process", badBinding).join("\n")).toContain("/roles/reviewer must be one of: installation.manager, installation.reviewer, installation.backupManager");

    const badIds = processDefinition();
    badIds.originKey = "nope";
    badIds.version = "1.2";
    badIds.key = "Not A Slug";
    expect(messages("process", badIds)).toEqual([
      expect.stringContaining("/key must match pattern"),
      "/originKey must be a UUID",
      "/version must be a semantic version (x.y.z)",
    ]);

    const capability = capabilityDefinition();
    capability.sideEffectClass = "weird";
    capability.bindings = [];
    expect(messages("capability", capability)).toEqual([
      "/bindings must NOT have fewer than 1 items",
      "/sideEffectClass must be one of: read, write_internal, write_external, send, publish, financial",
    ]);

    const evaluation = evaluationDefinition();
    evaluation.thresholds.requiredScenarioPassRate = 2;
    delete evaluation.scenarios[0].expected;
    expect(messages("evaluation", evaluation)).toEqual([
      "/scenarios/0 is missing required property \"expected\"",
      "/thresholds/requiredScenarioPassRate must be <= 1",
    ]);
  });
  it("rejects a definition of the wrong kind", () => {
    expect(messages("process", capabilityDefinition())).toContain('/kind must be "process"');
  });
  it("fails loudly and actionably when the artefact cannot be used", () => {
    const dir = mkdtempSync(join(tmpdir(), "mysmb-agent-validator-"));
    created.push(dir);
    const write = (name: string, body: string) => {
      const path = join(dir, name);
      writeFileSync(path, body);
      return path;
    };
    expect(() => loadStudioSchemaValidators(join(dir, "missing.json"))).toThrow(StudioContractError);
    expect(() => loadStudioSchemaValidators(write("garbage.json", "{"))).toThrow(/not valid JSON/);
    expect(() => loadStudioSchemaValidators(write("v2.json", JSON.stringify({ version: 2, schemas: {} })))).toThrow(/contract major 1 only/);
    expect(() => loadStudioSchemaValidators(write("partial.json", JSON.stringify({ version: 1, schemas: { process: {} } })))).toThrow(/no "capability" schema/);
  });
  it("keeps contentHash in lock-step with the Workspace recipe (sha256 of canonical JSON without the hash)", () => {
    const payload = envelope("capability", capabilityDefinition());
    expect(contentHashOf(payload)).toBe(payload.contentHash);
    expect(contentHashOf({ ...payload, name: "changed" })).not.toBe(payload.contentHash);
  });
});

// ── CLI fixtures (whole validator, temp registries) ───────────────────────────
// Defects are batched per rule family — one registry, one plugin per defect —
// so the suite spawns the validator a handful of times, not once per rule.

describe("validator CLI: business-agent packages", () => {
  it("passes a complete agent package, resolving capabilities through a declared dependency, and only warns on an ordinary plugin's version drift", () => {
    const legacy: PluginFixture = { name: "legacy-tool", entry: { version: "0.1.0" }, manifest: { version: "0.2.0" } };
    const result = run(registry([capabilityProvider(), agentPackage(), legacy]));
    expect(result.output).toContain("validate: OK");
    expect(result.ok).toBe(true);
    expect(result.output).toContain("validate: 1 warning");
    expect(result.output).toContain('plugins/legacy-tool: plugin.json version "0.2.0" does not match marketplace.json version "0.1.0"');
    expect(result.output).not.toContain("client-onboarding-agent");
  }, 30_000);

  it("keeps old registries (no agent content) passing without warnings", () => {
    const result = run(registry([{ name: "plain", entry: { version: "0.1.0" }, manifest: { version: "0.1.0" } }]));
    expect(result.ok).toBe(true);
    expect(result.output).toBe("validate: OK\n");
  }, 30_000);

  it("rejects unresolved references and listing.agent keys that match nothing bundled", () => {
    // No dependency on the capability provider: nothing the process uses outside its own plugin resolves.
    const broken = agentPackage();
    broken.entry = { ...broken.entry, dependencies: undefined };
    const process = processDefinition();
    process.capabilities = ["email.send_reviewed", "crm.read:client"];
    process.steps[1].automation = ID.ghost;
    process.steps[3].form = "a1000000-0000-4000-8000-0000000000f1";
    process.steps[4].template = "a1000000-0000-4000-8000-0000000000f2";
    process.tests = ["a1000000-0000-4000-8000-0000000000f3"];
    const evaluation = evaluationDefinition();
    evaluation.process = ID.ghost;
    broken.files = { ...broken.files, [PATHS.process]: envelope("process", process), [PATHS.evaluation]: envelope("evaluation", evaluation) };
    (broken.entry as any).listing.agent.processes = ["client-onboarding", "ghost-process"];
    (broken.entry as any).listing.agent.requiredCapabilities = ["email.send_reviewed", "ghost.capability"];

    const { ok, output } = run(registry([capabilityProvider(), broken]));
    const at = `plugins/client-onboarding-agent: ${PATHS.process} process "client-onboarding" references`;
    const suffix = "which is not bundled in this plugin or in a plugin listed in its dependencies[]";
    expect(ok).toBe(false);
    expect(output).toContain(`${at} capability email.send_reviewed at /definition/capabilities/0, ${suffix}`);
    expect(output).toContain(`${at} capability crm.read:client at /definition/capabilities/1, ${suffix}`);
    expect(output).toContain(`${at} automation ${ID.ghost} at /definition/steps/1/automation, ${suffix}`);
    expect(output).toContain(`${at} form a1000000-0000-4000-8000-0000000000f1 at /definition/steps/3/form, ${suffix}`);
    expect(output).toContain(`${at} template a1000000-0000-4000-8000-0000000000f2 at /definition/steps/4/template, ${suffix}`);
    expect(output).toContain(`${at} evaluation a1000000-0000-4000-8000-0000000000f3 at /definition/tests/0, ${suffix}`);
    expect(output).toContain(`${PATHS.evaluation} evaluation "client-onboarding-core" tests process ${ID.ghost} at /definition/process, ${suffix}`);
    expect(output).toContain('listing.agent.processes[1] "ghost-process" is not the definition.key of a process bundled');
    expect(output).toContain('listing.agent.requiredCapabilities[0] "email.send_reviewed" is not the definition.key of a capability bundled');
    expect(output).toContain('listing.agent.requiredCapabilities[1] "ghost.capability"');
    expect(output).not.toContain('listing.agent.processes[0]');
  }, 30_000);

  it("resolves an intent capability through the dependency, and flags one that nothing provides", () => {
    const agent = agentPackage();
    const process = processDefinition();
    process.steps[2].options[0].intent.capability = "crm.update";
    agent.files = { ...agent.files, [PATHS.process]: envelope("process", process) };
    const { ok, output } = run(registry([capabilityProvider(), agent]));
    expect(ok).toBe(false);
    expect(output).toContain("capability crm.update at /definition/steps/2/options/0/intent/capability");
    expect(output).not.toContain("capability email.send_reviewed at");
  }, 30_000);

  it("resolves platform capabilities without bundling them, and refuses a package that redefines one", () => {
    const agent = agentPackage();
    const process = processDefinition();
    process.capabilities = ["email.send_reviewed", "records.read:client", "workq.create", "knowledge.read", "artifacts.write"];
    agent.files = { ...agent.files, [PATHS.process]: envelope("process", process) };
    const accepted = run(registry([capabilityProvider(), agent]));
    expect(accepted.output).toContain("validate: OK");
    expect(accepted.ok).toBe(true);

    const unknownBase = processDefinition();
    unknownBase.capabilities = ["email.send_reviewed", "crm.read:client"];
    const stillUnresolved = agentPackage();
    stillUnresolved.files = { ...stillUnresolved.files, [PATHS.process]: envelope("process", unknownBase) };
    const unresolved = run(registry([capabilityProvider(), stillUnresolved]));
    expect(unresolved.ok).toBe(false);
    expect(unresolved.output).toContain("capability crm.read:client at /definition/capabilities/1");

    const redefining = capabilityProvider();
    const platformKey = capabilityDefinition();
    platformKey.key = "workq.create";
    const capabilityPath = `content/capabilities/${ID.capability}.json`;
    redefining.files = { [capabilityPath]: envelope("capability", platformKey) };
    const refused = run(registry([redefining, agent]));
    expect(refused.ok).toBe(false);
    expect(refused.output).toContain(`plugins/mail-capabilities: ${capabilityPath} capability key "workq.create" is a built-in platform capability and cannot be redefined by a package`);
  }, 30_000);

  it("reports contract-schema errors with the plugin path and the instance path", () => {
    const process = processDefinition();
    delete process.steps[0].skill;
    process.steps[5].bogus = true;
    process.roles.reviewer = "someone";
    const capability = capabilityDefinition();
    capability.sideEffectClass = "weird";
    const evaluation = evaluationDefinition();
    evaluation.thresholds.requiredScenarioPassRate = 2;
    const agent = agentPackage();
    agent.files = {
      ...agent.files,
      [PATHS.process]: envelope("process", process),
      [PATHS.evaluation]: envelope("evaluation", evaluation),
    };
    const provider = capabilityProvider();
    provider.files = { [`content/capabilities/${ID.capability}.json`]: envelope("capability", capability) };

    const { ok, output } = run(registry([provider, agent]));
    expect(ok).toBe(false);
    expect(output).toContain(`plugins/client-onboarding-agent: ${PATHS.process} schema error at /definition/steps/0: is missing required property "skill"`);
    expect(output).toContain(`plugins/client-onboarding-agent: ${PATHS.process} schema error at /definition/steps/5/bogus: is not allowed by the contract (unknown property)`);
    expect(output).toContain(`${PATHS.process} schema error at /definition/roles/reviewer: must be one of: installation.manager`);
    expect(output).toContain(`plugins/mail-capabilities: content/capabilities/${ID.capability}.json schema error at /definition/sideEffectClass: must be one of: read, write_internal`);
    expect(output).toContain(`${PATHS.evaluation} schema error at /definition/thresholds/requiredScenarioPassRate: must be <= 1`);
  }, 30_000);

  it("enforces the envelope: hash, filename, origin agreement, definition wrapper, section kind and canonical path", () => {
    const at = (name: string, kind: string, originKey: string, body: unknown, path = `content/capabilities/${originKey}.json`): PluginFixture => ({
      name,
      content: { [kind]: [path] },
      files: { [path]: body },
    });
    const goodCap = envelope("capability", capabilityDefinition());
    const otherOrigin = "a1000000-0000-4000-8000-0000000000a1";
    const flat = capabilityDefinition(); // the definition body written directly, with no { name, contentHash, definition } wrapper
    const retitled = clone(goodCap);
    retitled.definition.title = "Edited by hand";
    const crossed = envelope("capability", { ...capabilityDefinition(), originKey: otherOrigin });
    crossed.originKey = ID.capability; // envelope and definition disagree
    const rehash = { kind: "capability", originKey: ID.capability, name: "X", definition: { ...capabilityDefinition(), originKey: otherOrigin } };
    const registryRoot = registry([
      at("hash-edited", "capabilities", ID.capability, retitled),
      at("hash-malformed", "capabilities", ID.capability, { ...goodCap, contentHash: "ABC" }),
      at("flat-payload", "capabilities", ID.capability, flat),
      at("origin-disagree", "capabilities", ID.capability, { ...rehash, contentHash: createHash("sha256").update(canonicalJson(rehash)).digest("hex") }),
      at("wrong-section", "processes", ID.capability, goodCap, `content/processes/${ID.capability}.json`),
      at("wrong-filename", "capabilities", ID.capability, goodCap, `content/capabilities/${otherOrigin}.json`),
      at("nested-path", "capabilities", ID.capability, goodCap, `content/capabilities/nested/${ID.capability}.json`),
      at("wrong-dir", "evaluations", ID.capability, envelope("evaluation", evaluationDefinition()), `content/capabilities/${ID.evaluation}.json`),
      { ...at("crossed", "capabilities", ID.capability, crossed) },
      { name: "no-name", content: { capabilities: [`content/capabilities/${ID.capability}.json`] }, files: { [`content/capabilities/${ID.capability}.json`]: (({ name: _n, ...rest }) => rest)(goodCap) } },
    ]);
    const { ok, output } = run(registryRoot);
    expect(ok).toBe(false);
    const cap = `content/capabilities/${ID.capability}.json`;
    expect(output).toContain(`plugins/hash-edited: ${cap} contentHash does not match its content`);
    expect(output).toContain(`plugins/hash-malformed: ${cap} contentHash must be a 64-character lowercase sha256 hex digest`);
    expect(output).toContain(`plugins/flat-payload: ${cap} payload must carry its definition as an object under "definition"`);
    expect(output).toContain(`plugins/origin-disagree: ${cap} definition.originKey "${otherOrigin}" does not match the payload originKey "${ID.capability}"`);
    expect(output).toContain(`plugins/crossed: ${cap} definition.originKey "${otherOrigin}" does not match the payload originKey "${ID.capability}"`);
    expect(output).toContain(`plugins/wrong-section: content/processes/${ID.capability}.json payload kind "capability" does not match its plugin.json section "processes" (expected "process")`);
    expect(output).toContain(`plugins/wrong-filename: content/capabilities/${otherOrigin}.json filename "${otherOrigin}" does not match the payload originKey "${ID.capability}"`);
    expect(output).toContain(`plugins/nested-path: content/capabilities/nested/${ID.capability}.json Portable component must use its canonical origin path`);
    expect(output).toContain(`plugins/wrong-dir: content/capabilities/${ID.evaluation}.json is not a canonical portable component path`);
    expect(output).toContain(`plugins/no-name: ${cap} name must be a non-empty string`);
  }, 30_000);

  it("caps each business-agent section at thirty entries", () => {
    const paths = (dir: string) => Array.from({ length: 31 }, (_, i) => `content/${dir}/a1000000-0000-4000-8000-${String(i).padStart(12, "0")}.json`);
    const { ok, output } = run(registry([
      { name: "too-many-processes", content: { processes: paths("processes") } },
      { name: "too-many-capabilities", content: { capabilities: paths("capabilities") } },
      { name: "too-many-evaluations", content: { evaluations: paths("evaluations") } },
    ]));
    expect(ok).toBe(false);
    for (const [name, section] of [["too-many-processes", "processes"], ["too-many-capabilities", "capabilities"], ["too-many-evaluations", "evaluations"]]) {
      expect(output).toContain(`plugins/${name}: content.${section} exceeds its component limit`);
    }
  }, 30_000);

  it("gives recordTypes / setups the same envelope floor", () => {
    const record = "88f9e304-7afc-4b6c-b7c5-eaf0a39ed778";
    const setup = "bbf9e304-7afc-4b6c-b7c5-eaf0a39ed779";
    const { ok, output } = run(registry([
      { name: "bare-table", content: { recordTypes: [`content/record-types/${record}.json`] }, files: { [`content/record-types/${record}.json`]: { kind: "record_type", originKey: record } } },
      { name: "bare-setup", content: { setups: [`content/setups/${setup}.json`] }, files: { [`content/setups/${setup}.json`]: { kind: "setup", definition: [] } } },
    ]));
    expect(ok).toBe(false);
    expect(output).toContain(`plugins/bare-table: content/record-types/${record}.json payload must carry its definition as an object under "definition"`);
    expect(output).toContain(`plugins/bare-setup: content/setups/${setup}.json payload has no originKey`);
    expect(output).toContain(`plugins/bare-setup: content/setups/${setup}.json payload must carry its definition as an object`);
  }, 30_000);

  it("validates dependencies[]: unknown plugin, unsupported range, cycle and self-dependency", () => {
    const dep = (plugin: string, version = "^1.0.0") => ({ plugin, version });
    const { ok, output } = run(registry([
      { name: "base" },
      { name: "needs-ghost", entry: { dependencies: [dep("ghost")] } },
      { name: "bad-range", entry: { dependencies: [dep("base", ">=1.0.0"), dep("base", "*")] } },
      { name: "cycle-a", entry: { dependencies: [dep("cycle-b")] } },
      { name: "cycle-b", entry: { dependencies: [dep("cycle-a")] } },
      { name: "selfish", entry: { dependencies: [dep("selfish")] } },
    ]));
    expect(ok).toBe(false);
    expect(output).toContain('marketplace.json: plugin "needs-ghost" dependencies[0].plugin "ghost" is not a plugin in this registry');
    expect(output).toContain('plugin "bad-range" dependencies[0].version ">=1.0.0" is not a supported range');
    expect(output).toContain('plugin "bad-range" dependencies[1].version "*" is not a supported range');
    expect(output).toContain('marketplace.json: dependency cycle "cycle-a" -> "cycle-b" -> "cycle-a"');
    expect(output).toContain('plugin "selfish" dependencies[0].plugin "selfish" is the plugin itself');
  }, 30_000);

  it("requires agent packages to carry strict-semver versions that agree between plugin.json and marketplace.json", () => {
    const variant = (name: string, entryVersion: unknown, jsonVersion: unknown): PluginFixture => {
      const agent = agentPackage({ name });
      agent.entry = { ...agent.entry, version: entryVersion, dependencies: undefined };
      agent.manifest = jsonVersion === undefined ? {} : { version: jsonVersion };
      return {
        ...agent,
        // Self-contained: bundle its own capability so only the version rule can fail.
        content: { ...agent.content, capabilities: [`content/capabilities/${ID.capability}.json`] },
        files: { ...agent.files, [`content/capabilities/${ID.capability}.json`]: envelope("capability", capabilityDefinition()) },
      };
    };
    const { ok, output } = run(registry([
      variant("not-semver", "1.0", "1.0"),
      variant("drifted", "1.0.0", "1.0.1"),
      variant("no-json-version", "1.0.0", undefined),
      variant("no-entry-version", undefined, "1.0.0"),
      variant("fine", "2.0.0-rc.1", "2.0.0-rc.1"),
    ]));
    expect(ok).toBe(false);
    expect(output).toContain('plugin "not-semver" is an agent package and its version "1.0" is not strict semver');
    expect(output).toContain('plugins/drifted: plugin.json version "1.0.1" does not match marketplace.json version "1.0.0" — agent packages must keep them equal');
    expect(output).toContain('plugins/no-json-version: agent package "no-json-version" must declare a version in plugin.json');
    expect(output).toContain('plugin "no-entry-version" is an agent package (listing.agent) and must declare a version');
    expect(output).not.toContain('"fine"');
    expect(output).not.toContain("plugins/fine");
  }, 30_000);

  it("rejects malformed listing.agent and release blocks", () => {
    const { ok, output } = run(registry([
      { name: "bad-agent-block", entry: { version: "1.0.0", listing: { agent: { role: "x", outcomes: [], processes: [], requiredCapabilities: [], surprise: true } } }, manifest: { version: "1.0.0" } },
      { name: "bad-release", entry: { release: { evidenceHash: "nope", extra: 1 } } },
      { name: "agent-not-object", entry: { listing: { agent: "yes" } } },
    ]));
    expect(ok).toBe(false);
    expect(output).toContain('plugin "bad-agent-block" listing.agent.surprise is not a recognised field');
    expect(output).toContain('plugin "bad-release" release.evidenceHash must be a lowercase sha256 hex digest');
    expect(output).toContain('plugin "bad-release" release.extra is not a recognised field');
    expect(output).toContain('plugin "agent-not-object" listing.agent must be an object');
  }, 30_000);

  /** An agent package that bundles its own capability, so only the rule under test can fail. */
  function selfContainedAgent(name: string, process: Record<string, any>, extraFiles: Record<string, unknown> = {}): PluginFixture {
    const agent = agentPackage({ name });
    agent.entry = { ...agent.entry, dependencies: undefined };
    const capabilityPath = `content/capabilities/${ID.capability}.json`;
    return {
      ...agent,
      content: { ...agent.content, capabilities: [capabilityPath] },
      files: { ...agent.files, [capabilityPath]: envelope("capability", capabilityDefinition()), [PATHS.process]: envelope("process", process), ...extraFiles },
    };
  }

  it("rejects the process defects the runtime evaluator found: an output the step never produces, a materiality key nothing supplies", () => {
    const answered = processDefinition();
    answered.transitions[3].when = "steps.confirm.answered";

    const kickoffDate = processDefinition();
    kickoffDate.steps[2].materiality = ["kickoffDate", "recipient"];

    const option = processDefinition();
    option.transitions[2].when = "steps.approve.option != 'revise'";

    const fixed = processDefinition();
    fixed.transitions[3].when = "steps.confirm.choiceKey == 'confirm'";
    fixed.transitions[2].when = "steps.approve.decision != 'revise'";
    fixed.steps[2].materiality = ["clientContact", "steps.gather.plan.scopeVersion", "recipient"];

    const { ok, output } = run(
      registry([
        selfContainedAgent("reads-answered", answered),
        selfContainedAgent("bad-materiality", kickoffDate),
        selfContainedAgent("reads-option", option),
        selfContainedAgent("repaired", fixed),
      ]),
    );
    expect(ok).toBe(false);
    const at = (plugin: string) => `plugins/${plugin}: ${PATHS.process} process "client-onboarding"`;
    expect(output).toContain(`${at("reads-answered")} unknown_output_reference: steps.confirm.answered reads "answered" from external step "confirm", which never produces it`);
    expect(output).toContain("(at /definition/transitions/3/when)");
    expect(output).toContain(`${at("bad-materiality")} unknown_materiality_key: Materiality key "kickoffDate" is not an input of this process`);
    expect(output).toContain("(at /definition/steps/2/materiality/0)");
    expect(output).toContain(`${at("reads-option")} unknown_output_reference: steps.approve.option reads "option" from decision step "approve"`);
    expect(output).toContain("(the chosen option's key is `decision`)");
    expect(output).not.toContain("plugins/repaired");
  }, 30_000);

  it("checks an automation step against the outputs its bundled automation declares", () => {
    const flowIr = (...names: string[]) => ({ irVersion: 1, nodes: [{ id: "check", kind: "python", outputs: names.map((name) => ({ name, type: "str" })) }] });
    const automation = (...names: string[]) => ({ [PATHS.automation]: { kind: "automation", originKey: ID.automation, flowIr: flowIr(...names) } });
    const reads = (field: string) => {
      const process = processDefinition();
      process.transitions[1].when = `steps.check.${field}`;
      return process;
    };
    const { ok, output } = run(
      registry([
        selfContainedAgent("reads-declared", reads("balanced"), automation("balanced")),
        selfContainedAgent("reads-runtime-key", reads("status"), automation("balanced")),
        selfContainedAgent("reads-undeclared", reads("difference"), automation("balanced")),
        selfContainedAgent("declares-nothing", reads("anything_at_all"), automation()),
      ]),
    );
    expect(ok).toBe(false);
    expect(output).toContain('plugins/reads-undeclared:');
    expect(output).toContain('unknown_output_reference: steps.check.difference reads "difference" from automation step "check"');
    expect(output).toContain("(at /definition/transitions/1/when)");
    for (const clean of ["reads-declared", "reads-runtime-key", "declares-nothing"]) expect(output).not.toContain(`plugins/${clean}:`);
  }, 30_000);

  it("refuses a recipient an agent or an outsider wrote", () => {
    const fromAgent = processDefinition();
    fromAgent.steps[0].outputs = ["plan", "contact"];
    fromAgent.steps[3].recipient = "steps.gather.contact";

    const payloadTo = processDefinition();
    payloadTo.steps[2].options[0].intent.payloadFrom = "steps.gather.plan.to";

    const { ok, output } = run(
      registry([
        selfContainedAgent("agent-recipient", fromAgent),
        selfContainedAgent("payload-recipient", payloadTo),
      ]),
    );
    expect(ok).toBe(false);
    expect(output).toContain(`plugins/agent-recipient: ${PATHS.process} process "client-onboarding" recipient_from_untrusted_output: steps.gather.contact takes the recipient from the output of agent step "gather"`);
    expect(output).toContain("(at /definition/steps/3/recipient)");
    expect(output).toContain("recipient_from_untrusted_output: steps.gather.plan.to takes the recipient");
    expect(output).toContain("(at /definition/steps/2/options/0/intent/payloadFrom)");
  }, 30_000);

  it("resolves an automation's declared outputs through a declared dependency", () => {
    // The automation lives in a provider plugin the agent depends on, so its outputs are known without being bundled alongside.
    const provider: PluginFixture = {
      name: "automation-provider",
      entry: { version: "1.0.0" },
      manifest: { version: "1.0.0" },
      content: { automations: [PATHS.automation] },
      files: { [PATHS.automation]: { kind: "automation", originKey: ID.automation, flowIr: { nodes: [{ kind: "python", outputs: [{ name: "balanced" }] }] } } },
    };
    const process = processDefinition();
    process.transitions[1].when = "steps.check.difference";
    const agent = selfContainedAgent("depends-on-provider", process);
    agent.entry = { ...agent.entry, dependencies: [{ plugin: "automation-provider", version: "^1.0.0" }] };
    agent.content = { ...agent.content, automations: [] };
    delete (agent.files as Record<string, unknown>)[PATHS.automation];
    const { ok, output } = run(registry([provider, agent]));
    expect(ok).toBe(false);
    expect(output).toContain('plugins/depends-on-provider:');
    expect(output).toContain('unknown_output_reference: steps.check.difference reads "difference" from automation step "check"');
  }, 30_000);

  it("validates a withdrawn block on a catalogue entry", () => {
    const withdrawn = (extra: Record<string, unknown>) => ({ since: "2026-10-01", reason: "Replaced by the new package.", ...extra });
    const { ok, output } = run(
      registry([
        { name: "replacement" },
        { name: "fine-withdrawn", entry: { withdrawn: withdrawn({ alternative: "replacement", retireBy: "2026-12-01" }) } },
        { name: "bad-since", entry: { withdrawn: withdrawn({ since: "yesterday" }) } },
        { name: "blank-reason", entry: { withdrawn: withdrawn({ reason: "   " }) } },
        { name: "ghost-alternative", entry: { withdrawn: withdrawn({ alternative: "ghost" }) } },
        { name: "retire-first", entry: { withdrawn: withdrawn({ retireBy: "2026-09-01" }) } },
        { name: "extra-key", entry: { withdrawn: withdrawn({ note: "x" }) } },
        { name: "not-an-object", entry: { withdrawn: "yes" } },
      ]),
    );
    expect(ok).toBe(false);
    expect(output).toContain('plugin "bad-since" withdrawn.since must be an ISO 8601 date');
    expect(output).toContain('plugin "blank-reason" withdrawn.reason must be a non-empty string');
    expect(output).toContain('plugin "ghost-alternative" withdrawn.alternative "ghost" is not a plugin in this registry');
    expect(output).toContain('plugin "retire-first" withdrawn.retireBy "2026-09-01" must be after withdrawn.since "2026-10-01"');
    expect(output).toContain('plugin "extra-key" withdrawn.note is not a recognised field');
    expect(output).toContain('plugin "not-an-object" withdrawn must be an object');
    expect(output).not.toContain('"fine-withdrawn"');
    expect(output).not.toContain('"replacement"');
  }, 30_000);

  it("accepts a well-formed withdrawn block", () => {
    const result = run(
      registry([
        { name: "replacement" },
        { name: "old", entry: { withdrawn: { since: "2026-10-01T09:00:00Z", reason: "Superseded.", alternative: "replacement", retireBy: "2026-12-01" } } },
      ]),
    );
    expect(result.output).toBe("validate: OK\n");
    expect(result.ok).toBe(true);
  }, 30_000);
});
