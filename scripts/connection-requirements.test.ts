import { afterAll, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateConnectionRequirements } from "./connection-requirements";

type Rec = Record<string, unknown>;
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

const GMAIL_KEY = "11111111-1111-4111-8111-111111111111";

/** A throwaway plugin dir with the given servers and automations (originKey → name). */
function pluginDir(servers: string[], automations: Record<string, string> = {}): string {
  const dir = mkdtempSync(join(tmpdir(), "requirements-"));
  dirs.push(dir);
  writeFileSync(
    join(dir, ".mcp.json"),
    JSON.stringify({ mcpServers: Object.fromEntries(servers.map((s) => [s, { type: "http", url: "https://example.com/mcp" }])) }),
  );
  mkdirSync(join(dir, "content", "automations"), { recursive: true });
  for (const [originKey, name] of Object.entries(automations)) {
    writeFileSync(join(dir, "content", "automations", `${originKey}.json`), JSON.stringify({ originKey, name }));
  }
  return dir;
}

const google = pluginDir(["google-workspace-gmail"]);
const own = pluginDir(["ledger", "shared-mail"], { [GMAIL_KEY]: "Intake (Gmail)" });
const dirOf = (name: string) => (name === "google-workspace" ? google : null);

function entry(requirements: unknown): Rec {
  return { name: "pack", connectionRequirements: requirements };
}

const VALID = {
  schema: 1,
  required: ["ledger"],
  choices: [
    {
      id: "bill_mailbox",
      question: "Which mailbox receives your bills?",
      options: [
        {
          id: "gmail",
          label: "Gmail",
          provider: "google",
          providerDefault: true,
          server: "google-workspace-gmail",
          package: "google-workspace",
          automation: { originKey: GMAIL_KEY, name: "Intake (Gmail)" },
        },
        { id: "shared", label: "Shared mailbox", server: "shared-mail", reads: "configured_mailbox" },
        { id: "none", label: "No mailbox" },
      ],
    },
  ],
};

const withOption = (i: number, patch: Rec) => ({
  ...VALID,
  choices: [{ ...VALID.choices[0], options: VALID.choices[0].options.map((o, j) => (j === i ? { ...o, ...patch } : o)) }],
});

describe("validateConnectionRequirements", () => {
  it("accepts a block whose servers, packages and automations all exist", () => {
    expect(validateConnectionRequirements(entry(VALID), own, dirOf)).toEqual([]);
  });

  it("refuses unknown keys, a second choice, links and a duplicate provider default", () => {
    expect(validateConnectionRequirements(entry({ ...VALID, extra: 1 }), own, dirOf)).not.toEqual([]);
    expect(validateConnectionRequirements(entry({ ...VALID, choices: [VALID.choices[0], VALID.choices[0]] }), own, dirOf)).not.toEqual([]);
    expect(validateConnectionRequirements(entry({ ...VALID, choices: [{ ...VALID.choices[0], question: "See www.x.com" }] }), own, dirOf)).not.toEqual([]);
    expect(validateConnectionRequirements(entry(withOption(1, { provider: "google", providerDefault: true })), own, dirOf)).toContainEqual(
      expect.stringContaining('provider "google" has 2 default options'),
    );
  });

  it("refuses an unknown read target", () => {
    expect(validateConnectionRequirements(entry(withOption(1, { reads: "delegate" })), own, dirOf)).not.toEqual([]);
  });

  it("refuses servers the package (or the named package) does not ship", () => {
    expect(validateConnectionRequirements(entry({ ...VALID, required: ["payroll"] }), own, dirOf)).toEqual([
      'required server "payroll" is not in the package\'s .mcp.json',
    ]);
    expect(validateConnectionRequirements(entry(withOption(0, { server: "google-workspace-drive" })), own, dirOf)).toEqual([
      'option "gmail": package "google-workspace" does not ship server "google-workspace-drive"',
    ]);
    expect(validateConnectionRequirements(entry(withOption(0, { package: "yahoo-mail" })), own, dirOf)).toEqual([
      'option "gmail": package "yahoo-mail" is not in marketplace.json',
    ]);
  });

  it("refuses an automation that is missing or named differently", () => {
    expect(
      validateConnectionRequirements(entry(withOption(0, { automation: { originKey: GMAIL_KEY, name: "Intake (Outlook)" } })), own, dirOf),
    ).toEqual([`option "gmail": automation ${GMAIL_KEY} is named "Intake (Gmail)", not "Intake (Outlook)"`]);
    const missing = "22222222-2222-4222-8222-222222222222";
    expect(
      validateConnectionRequirements(entry(withOption(0, { automation: { originKey: missing, name: "Intake (Gmail)" } })), own, dirOf),
    ).toEqual([`option "gmail": automation ${missing} is not in the package`]);
  });

  it("the live bookkeeping-xero entry is valid: Xero required, every mailbox optional until chosen", () => {
    const marketplace = JSON.parse(readFileSync(join(repoRoot, ".claude-plugin", "marketplace.json"), "utf8")) as { plugins: Rec[] };
    const xero = marketplace.plugins.find((p) => p.name === "bookkeeping-xero")!;
    const pluginsDir = join(repoRoot, "plugins");
    expect(
      validateConnectionRequirements(xero, join(pluginsDir, "bookkeeping-xero"), (name) =>
        marketplace.plugins.some((p) => p.name === name) ? join(pluginsDir, name) : null,
      ),
    ).toEqual([]);
    const r = xero.connectionRequirements as { required: string[]; choices: Array<{ options: Array<{ id: string; server?: string }> }> };
    expect(r.required).toEqual(["xero-accounting"]);
    // The shared mailbox is a target set in the package's setup, never the delegate's own account.
    const shared = (r.choices[0].options as Array<{ id: string; reads?: string }>).find((o) => o.id === "outlook_shared");
    expect(shared?.reads).toBe("configured_mailbox");
    expect(r.choices[0].options.map((o) => [o.id, o.server ?? null])).toEqual([
      ["gmail", "google-workspace-gmail"],
      ["outlook", "m365-mail-read"],
      ["hotmail", "hotmail-mail"],
      ["outlook_shared", "m365-mail-shared"],
      ["none", null],
    ]);
  });
});

const ledgers = pluginDir(["xero-accounting", "myob-accounting", "quickbooks-accounting"]);
const GROUPS = {
  schema: 1,
  required: [],
  groups: [
    {
      id: "accounting_system",
      label: "Accounting system",
      min: 1,
      options: [
        { id: "xero", label: "Xero", servers: ["xero-accounting"] },
        { id: "myob", label: "MYOB", servers: ["myob-accounting"] },
      ],
    },
  ],
};

describe("validateConnectionRequirements — groups", () => {
  it("accepts an at-least-one group of the package's own servers", () => {
    expect(validateConnectionRequirements(entry(GROUPS), ledgers, dirOf)).toEqual([]);
  });

  it("refuses a minimum above the options, a zero minimum, duplicate ids and a server named twice", () => {
    const g = GROUPS.groups[0];
    const check = (group: unknown, required: string[] = []) =>
      validateConnectionRequirements(entry({ schema: 1, required, groups: [group] }), ledgers, dirOf);
    expect(check({ ...g, min: 3 })).toContainEqual(expect.stringContaining("needs 3 of only 2 options"));
    expect(check({ ...g, min: 0 })).not.toEqual([]);
    expect(check({ ...g, options: [g.options[0], g.options[0]] })).toContainEqual(expect.stringContaining("option ids must be unique"));
    expect(check({ ...g, options: [g.options[0], { ...g.options[1], servers: ["xero-accounting"] }] })).toContainEqual(
      expect.stringContaining('"xero-accounting", which is already named'),
    );
    expect(check(g, ["xero-accounting"])).toContainEqual(expect.stringContaining("already named"));
  });

  it("refuses a group server the package (or the named package) does not ship", () => {
    const g = GROUPS.groups[0];
    expect(
      validateConnectionRequirements(
        entry({ ...GROUPS, groups: [{ ...g, options: [...g.options, { id: "sage", label: "Sage", servers: ["sage-accounting"] }] }] }),
        ledgers,
        dirOf,
      ),
    ).toEqual(['group "accounting_system" option "sage": server "sage-accounting" is not in the package\'s .mcp.json']);
    expect(
      validateConnectionRequirements(
        entry({ ...GROUPS, groups: [{ ...g, options: [...g.options, { id: "gmail", label: "Gmail", servers: ["google-workspace-drive"], package: "google-workspace" }] }] }),
        ledgers,
        dirOf,
      ),
    ).toEqual(['group "accounting_system" option "gmail": package "google-workspace" does not ship server "google-workspace-drive"']);
  });
});

describe("the live marketplace entries", () => {
  const marketplace = JSON.parse(readFileSync(join(repoRoot, ".claude-plugin", "marketplace.json"), "utf8")) as { plugins: Rec[] };
  const pluginsDir = join(repoRoot, "plugins");
  const live = (name: string) => marketplace.plugins.find((p) => p.name === name)!;
  const errors = (name: string) =>
    validateConnectionRequirements(live(name), join(pluginsDir, name), (n) =>
      marketplace.plugins.some((p) => p.name === n) ? join(pluginsDir, n) : null,
    );
  type Block = { required: string[]; groups?: Array<{ min: number; options: Array<{ id: string; servers: string[] }> }> };
  const block = (name: string) => live(name).connectionRequirements as Block;
  const servers = (name: string) => Object.keys(JSON.parse(readFileSync(join(pluginsDir, name, ".mcp.json"), "utf8")).mcpServers).sort();

  it("Practice Report Analytics: at least one of Xero and MYOB, nothing required on its own", () => {
    expect(errors("practice-report-analytics")).toEqual([]);
    expect(block("practice-report-analytics").required).toEqual([]);
    expect(block("practice-report-analytics").groups?.map((g) => [g.min, g.options.map((o) => [o.id, o.servers])])).toEqual([
      [1, [["xero", ["xero-accounting"]], ["myob", ["myob-accounting"]]]],
    ]);
  });

  it("Client Report Analytics: at least one of Xero, MYOB and QuickBooks", () => {
    expect(errors("client-report-analytics")).toEqual([]);
    expect(block("client-report-analytics").required).toEqual([]);
    expect(block("client-report-analytics").groups?.map((g) => [g.min, g.options.map((o) => [o.id, o.servers])])).toEqual([
      [1, [["xero", ["xero-accounting"]], ["myob", ["myob-accounting"]], ["quickbooks", ["quickbooks-accounting"]]]],
    ]);
  });

  it("Hammerjack: Sprout Employee and Time & Attendance required, HR General optional", () => {
    expect(errors("hammerjack")).toEqual([]);
    expect(block("hammerjack")).toEqual({ schema: 1, required: ["sprout-employee", "sprout-time-attendance"] });
    expect(servers("hammerjack")).toContain("sprout-hr-general");
  });

  it("Microsoft 365: every server is its own optional feature, at least one needed, nothing required", () => {
    expect(errors("microsoft-365")).toEqual([]);
    const b = block("microsoft-365");
    expect(b.required).toEqual([]);
    expect(b.groups).toHaveLength(1);
    expect(b.groups![0].min).toBe(1);
    // One feature per server, and every server the package ships is a feature — work and Hotmail alike.
    expect(b.groups![0].options.every((o) => o.servers.length === 1)).toBe(true);
    expect(b.groups![0].options.flatMap((o) => o.servers).sort()).toEqual(servers("microsoft-365"));
  });

  it("Google Workspace carries no block: every service it ships stays required", () => {
    expect(live("google-workspace")).not.toHaveProperty("connectionRequirements");
  });
});
