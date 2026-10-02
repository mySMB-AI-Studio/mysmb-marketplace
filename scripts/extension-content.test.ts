import { afterAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, validatePortableContent } from "./extension-content";

const recordOrigin = "88f9e304-7afc-4b6c-b7c5-eaf0a39ed778";
const setupOrigin = "bbf9e304-7afc-4b6c-b7c5-eaf0a39ed779";
const extraOrigin = "ccf9e304-7afc-4b6c-b7c5-eaf0a39ed780";
const scriptPath = join(dirname(fileURLToPath(import.meta.url)), "validate.ts");
const fixtures: string[] = [];
function signed(content: Record<string, unknown>) {
  return { ...content, contentHash: createHash("sha256").update(canonicalJson(content)).digest("hex") };
}
function table() {
  return signed({ kind: "record_type", originKey: recordOrigin, name: "Staffing",
    definition: { slug: "staffing", labelSingular: "Staff", labelPlural: "Staff",
      fields: [{ key: "name", label: "Name", kind: "text", promoted: "title", config: { Z: "z", a: "a" } }] } });
}
function setup(originKey = setupOrigin) {
  return signed({ kind: "setup", originKey, name: "Setup", definition: { version: 1,
    steps: [{ id: "general", title: "General", fields: [
      { key: "sync_reports", label: "Sync reports", type: "boolean", default: false },
      { key: "review_day", label: "Review day", type: "number", default: 0 },
    ], connectors: [{ key: "hr_account", server: "sprout-employee", label: "HR account", scope: "either", required: false }] }] } });
}
function fixture(content?: Record<string, string[]>, payloads: Record<string, unknown> = {}) {
  const root = mkdtempSync(join(tmpdir(), "mysmb-extension-validator-"));
  fixtures.push(root);
  const pluginDir = join(root, "plugins", "synthetic-extension");
  function json(path: string, value: unknown) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(value));
  }
  json(join(root, ".claude-plugin", "marketplace.json"), { name: "test", plugins: [{ name: "synthetic-extension", source: "./plugins/synthetic-extension" }] });
  json(join(pluginDir, ".claude-plugin", "plugin.json"), { name: "synthetic-extension", ...(content ? { content } : {}) });
  json(join(pluginDir, ".mcp.json"), { mcpServers: {} });
  writeFileSync(join(pluginDir, "README.md"), "# Synthetic extension\n\n## Configuration\nNone.\n");
  for (const [path, payload] of Object.entries(payloads)) json(join(pluginDir, path), payload);
  return root;
}
function cli(root: string): { ok: boolean; output: string } {
  try {
    return { ok: true, output: execFileSync(process.execPath, ["--import", "tsx", scriptPath, `--root=${root}`], { encoding: "utf8", stdio: "pipe" }) };
  } catch (error) {
    const result = error as { stdout?: string; stderr?: string };
    return { ok: false, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
  }
}
afterAll(() => {
  for (const root of fixtures) {
    const within = relative(resolve(tmpdir()), resolve(root));
    if (!within || within.startsWith("..") || isAbsolute(within) || !within.startsWith("mysmb-extension-validator-")) throw new Error("Unsafe fixture cleanup path");
    rmSync(root, { recursive: true, force: true });
  }
});

describe("portable contracts", () => {
  it("matches Workspace canonical byte ordering and accepts false/zero defaults", () => {
    expect(canonicalJson({ z: [2, 1], a: { Z: 1, a: 2, absent: undefined } })).toBe('{"a":{"Z":1,"a":2},"z":[2,1]}');
    expect(canonicalJson({ config: { "10": "ten", "2": "two" } })).toBe('{"config":{"2":"two","10":"ten"}}');
    expect(() => validatePortableContent("record_type", table())).not.toThrow();
    expect(() => validatePortableContent("setup", setup())).not.toThrow();
  });
  it("rejects content tampering and tenant data/credentials in packaged definitions", () => {
    expect(() => validatePortableContent("setup", { ...setup(), name: "tampered" })).toThrow(/contentHash/);
    expect(() => validatePortableContent("record_type", signed({ ...table(), records: [{ name: "customer" }] }))).toThrow();
    const definition = { version: 1, steps: [{ id: "general", title: "General", fields: [{ key: "api_token", label: "Token", type: "string" }], connectors: [] }] };
    expect(() => validatePortableContent("setup", signed({ kind: "setup", originKey: setupOrigin, name: "Bad", definition }))).toThrow(/Connections/);
  });
  it("rejects invalid defaults and duplicate setup keys", () => {
    for (const fields of [
      [{ key: "n", label: "Number", type: "number", default: "wrong" }],
      [{ key: "pick", label: "Pick", type: "select", default: "missing", options: [{ value: "a", label: "A" }] }],
      [{ key: "same", label: "First", type: "string" }, { key: "same", label: "Second", type: "string" }],
    ]) {
      const definition = { version: 1, steps: [{ id: "general", title: "General", fields, connectors: [] }] };
      expect(() => validatePortableContent("setup", signed({ kind: "setup", originKey: setupOrigin, name: "Bad", definition }))).toThrow();
    }
  });
  it("rejects portal policy that omits required create fields or can clear hidden data", () => {
    const portalAccess = { enabled: true, operations: ["read", "create", "update"], visibleFields: ["name"], editableFields: ["name"] };
    for (const field of [
      { key: "private_note", label: "Private", kind: "text", required: true },
      { key: "private_note", label: "Private", kind: "text", rules: [{ kind: "only_when", when: { field: "name", op: "eq", value: "active" } }] },
    ]) {
      const definition = { slug: "staffing", labelSingular: "Staff", labelPlural: "Staff", settings: { portalAccess }, fields: [{ key: "name", label: "Name", kind: "text" }, field] };
      expect(() => validatePortableContent("record_type", signed({ kind: "record_type", originKey: recordOrigin, name: "Bad", definition }))).toThrow(/Portal/);
    }
  });
  it("rejects editable anchor relations while accepting declared custom record relations", () => {
    for (const target of ["todo", "record:staffing"]) {
      const definition = { slug: "staffing", labelSingular: "Staff", labelPlural: "Staff", fields: [{ key: "name", label: "Name", kind: "text" }, { key: "relation", label: "Related", kind: "relation", config: { target } }], settings: { portalAccess: { enabled: true, operations: ["read", "update"], visibleFields: ["name", "relation"], editableFields: ["relation"] } } };
      const check = () => validatePortableContent("record_type", signed({ kind: "record_type", originKey: recordOrigin, name: "Staffing", definition }));
      if (target === "todo") expect(check).toThrow(/custom record target/); else expect(check).not.toThrow();
    }
  });
});

describe("marketplace CLI content gate", () => {
  const recordPath = `content/record-types/${recordOrigin}.json`;
  const setupPath = `content/setups/${setupOrigin}.json`;
  it("keeps old manifests and old content working", () => {
    expect(cli(fixture()).ok).toBe(true);
    const path = `content/forms/${recordOrigin}.json`;
    expect(cli(fixture({ forms: [path] }, { [path]: { kind: "form", originKey: recordOrigin } })).ok).toBe(true);
  }, 15_000);
  it("accepts portable tables/setup and resolves automation dependency kinds", () => {
    const path = `content/automations/${extraOrigin}.json`;
    const result = cli(fixture({ recordTypes: [recordPath], setups: [setupPath], automations: [path] }, {
      [recordPath]: table(), [setupPath]: setup(), [path]: { kind: "automation", originKey: extraOrigin, dependencies: [{ entityKind: "record_type", originKey: recordOrigin }, { entityKind: "setup", originKey: setupOrigin }] },
    }));
    expect(result).toEqual({ ok: true, output: expect.stringContaining("validate: OK") });
  }, 15_000);
  it("accepts twenty table schemas and rejects a twenty-first schema", () => {
    const paths: string[] = [], payloads: Record<string, unknown> = {};
    for (let i = 1; i <= 21; i++) {
      const origin = `00000000-0000-4000-8000-${i.toString().padStart(12, "0")}`;
      const path = `content/record-types/${origin}.json`;
      paths.push(path); payloads[path] = signed({ kind: "record_type", originKey: origin, name: `Table ${i}`, definition: { slug: `table_${i}`, labelSingular: "Entry", labelPlural: "Entries", fields: [{ key: "name", label: "Name", kind: "text" }] } });
    }
    expect(cli(fixture({ recordTypes: paths.slice(0, 20) }, payloads)).ok).toBe(true);
    expect(cli(fixture({ recordTypes: paths }, payloads)).ok).toBe(false);
  }, 15_000);
  it("rejects nested portable paths even when the filename matches its origin", () => {
    const path = `content/setups/nested/${setupOrigin}.json`;
    const result = cli(fixture({ setups: [path] }, { [path]: setup() }));
    expect(result.ok).toBe(false);
    expect(result.output).toContain("canonical origin path");
  }, 15_000);
  it("enforces the portable file limit in bytes for non-ASCII content", () => {
    const definition = { version: 1, steps: [0, 1].map((step) => ({ id: `step_${step}`, title: "Details", connectors: [], fields: Array.from({ length: 100 }, (_, field) => ({ key: `field_${step}_${field}`, label: "Field", type: "string", helpText: "界".repeat(2000) })) })) };
    const payload = signed({ kind: "setup", originKey: setupOrigin, name: "Large setup", definition });
    expect(JSON.stringify(payload).length).toBeLessThan(1_000_000);
    expect(Buffer.byteLength(JSON.stringify(payload))).toBeGreaterThan(1_000_000);
    const result = cli(fixture({ setups: [setupPath] }, { [setupPath]: payload }));
    expect(result.ok).toBe(false);
    expect(result.output).toContain("1 MB limit");
  }, 15_000);
  it.each(["missing", "hash", "kind", "escape", "duplicate", "dependency"] as const)("rejects %s portable content", (reason) => {
    const content: Record<string, string[]> = { recordTypes: [recordPath], setups: [setupPath] };
    const payloads: Record<string, unknown> = { [recordPath]: table(), [setupPath]: setup() };
    if (reason === "missing") delete payloads[setupPath];
    if (reason === "hash") payloads[setupPath] = { ...setup(), contentHash: "0".repeat(64) };
    if (reason === "kind") payloads[recordPath] = setup();
    if (reason === "escape") content.setups = ["../../outside.json"];
    if (reason === "duplicate") {
      const extraPath = `content/setups/${extraOrigin}.json`;
      content.setups.push(extraPath); payloads[extraPath] = setup(extraOrigin);
    }
    if (reason === "dependency") {
      const path = `content/automations/${extraOrigin}.json`;
      content.automations = [path]; payloads[path] = { kind: "automation", originKey: extraOrigin, dependencies: [{ entityKind: "record_type", originKey: setupOrigin }] };
    }
    const result = cli(fixture(content, payloads));
    expect(result.ok).toBe(false);
    expect(result.output).toContain("validate: FAILED");
  }, 15_000);
});
