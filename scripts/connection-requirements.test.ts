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
