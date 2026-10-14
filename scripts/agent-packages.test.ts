import { afterAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson } from "./extension-content";
import {
  checkVersionAgreement,
  collectProcessReferences,
  contentHashOf,
  findDependencyCycles,
  isSemverRange,
  isStrictSemver,
  loadStudioSchemaValidators,
  StudioContractError,
  validateAgentListingShape,
  validateDependencies,
  validateReleaseShape,
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
        key: "approve", kind: "decision", type: "kickoff", eligible: ["reviewer"], materiality: ["kickoffDate"],
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
      [PATHS.automation]: { kind: "automation", originKey: ID.automation },
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
    process.capabilities = ["email.send_reviewed", "records.read:client"];
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
    expect(output).toContain(`${at} capability records.read:client at /definition/capabilities/1, ${suffix}`);
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
});
