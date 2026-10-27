import { afterAll, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateWelcomeMetadata } from "./welcome-metadata";

type Rec = Record<string, unknown>;
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

/**
 * A throwaway plugin dir: a `.mcp.json` with servers (default), an empty one, or none at
 * all; widget ids (in `widgetsDir`, default `widgets`); and plugin.json connection auth.
 */
function pluginDir(
  opts: { mcp?: "servers" | "empty" | "absent"; widgets?: string[]; widgetsDir?: string; pluginAuth?: string } = {},
): string {
  const dir = mkdtempSync(join(tmpdir(), "welcome-"));
  dirs.push(dir);
  if (opts.pluginAuth) {
    mkdirSync(join(dir, ".claude-plugin"));
    writeFileSync(join(dir, ".claude-plugin", "plugin.json"), JSON.stringify({ name: "pkg", connection: { authType: opts.pluginAuth } }));
  }
  const mcp = opts.mcp ?? "servers";
  if (mcp !== "absent") {
    writeFileSync(
      join(dir, ".mcp.json"),
      JSON.stringify({ mcpServers: mcp === "empty" ? {} : { acct: { type: "http", url: "https://example.com/mcp" } } }),
    );
  }
  if (opts.widgets) {
    const widgetsDir = join(dir, opts.widgetsDir ?? "widgets");
    mkdirSync(widgetsDir, { recursive: true });
    for (const w of opts.widgets) writeFileSync(join(widgetsDir, `${w}.json`), JSON.stringify({ id: w }));
  }
  return dir;
}

function block(overrides: Rec = {}): Rec {
  return {
    schema: 1,
    audience: {
      anchor: "tool",
      industries: ["bookkeeping"],
      roles: ["bookkeeper"],
      requireRole: false,
      businessTypes: [],
      needs: ["save_time", "reduce_errors"],
    },
    provider: { group: "accounting", tool: "xero" },
    install: "selected_tool",
    cost: "free",
    auth: "oauth",
    credentials: "per_user",
    dependencies: [],
    setup: { steps: [{ kind: "connect", title: "Connect Xero", detail: "Sign in as yourself." }] },
    ...overrides,
  };
}
const audience = (o: Rec) => ({ ...(block().audience as Rec), ...o });
const entry = (welcome: unknown, extra: Rec = {}): Rec => ({ name: "pkg", welcome, ...extra });
const errorsFor = (welcome: unknown, extra: Rec = {}, dir = pluginDir()) => validateWelcomeMetadata(entry(welcome, extra), dir);

describe("valid blocks", () => {
  it("accepts a complete tool-anchored block", () => {
    expect(errorsFor(block())).toEqual([]);
  });
  it("accepts an industry anchor, suggest-only, with defaults omitted", () => {
    const w = block({
      audience: { anchor: "industry", industries: ["trades"] },
      provider: undefined,
      install: "suggest_only",
      credentials: "shared",
      auth: "api_key",
      setup: undefined,
    });
    expect(errorsFor(w)).toEqual([]);
  });
  it("accepts a cross_industry_default that requires its role", () => {
    const w = block({
      audience: { anchor: "cross_industry_default", roles: ["owner"], requireRole: true },
      provider: undefined,
      install: "reviewed_default",
    });
    expect(errorsFor(w)).toEqual([]);
  });
  it("accepts a primaryTile that is one of the package's widgets", () => {
    const dir = pluginDir({ widgets: ["pkg-jobs", "pkg-other"] });
    expect(errorsFor(block({ primaryTile: "pkg-jobs" }), {}, dir)).toEqual([]);
  });
});

describe("malformed blocks", () => {
  it.each<[string, unknown]>([
    ["a non-object", "welcome"],
    ["null", null],
    ["an array", []],
    ["a missing schema", (() => { const b = block(); delete b.schema; return b; })()],
    ["an unknown top-level key", block({ extra: 1 })],
    ["an unknown audience key", block({ audience: audience({ extra: 1 }) })],
    ["an unknown provider key", block({ provider: { group: "accounting", tool: "xero", extra: 1 } })],
    ["a bad anchor", block({ audience: audience({ anchor: "role" }) })],
    ["an option id with capitals", block({ audience: audience({ roles: ["Bookkeeper"] }) })],
    ["an option id with a space", block({ audience: audience({ industries: ["real estate"] }) })],
    ["a bad install", block({ install: "always" })],
    ["a bad cost", block({ cost: "freemium" })],
    ["a bad auth", block({ auth: "basic" })],
    ["a bad credentials value", block({ credentials: "team" })],
    ["non-array dependencies", block({ dependencies: "none" })],
    ["a bad dependency name", block({ dependencies: ["Not A Name"] })],
    ["an empty setup", block({ setup: { steps: [] } })],
    ["nine setup steps", block({ setup: { steps: Array.from({ length: 9 }, () => ({ kind: "learn", title: "Step" })) } })],
    ["a bad step kind", block({ setup: { steps: [{ kind: "install", title: "x" }] } })],
    ["an over-long step title", block({ setup: { steps: [{ kind: "learn", title: "x".repeat(81) }] } })],
    ["an over-long step detail", block({ setup: { steps: [{ kind: "learn", title: "x", detail: "y".repeat(241) }] } })],
    ["an unknown step key", block({ setup: { steps: [{ kind: "learn", title: "x", url: "y" }] } })],
    ["a bad primaryTile id", block({ primaryTile: "Not A Widget" })],
  ])("rejects %s", (_label, welcome) => {
    expect(errorsFor(welcome).length).toBeGreaterThan(0);
  });

  it("rejects an unsupported schema version by name", () => {
    expect(errorsFor(block({ schema: 2 }))).toEqual(["welcome.schema 2 is not supported (only 1)"]);
  });
});

describe("plain-text setup steps", () => {
  const step = (o: Rec) => block({ setup: { steps: [{ kind: "learn", title: "Title", ...o }] } });
  it.each([
    ["https link", "See https://example.com"],
    ["http link", "See http://example.com"],
    ["www link", "Go to www.example.com"],
    ["mailto link", "Write to mailto:a@b.co"],
    ["javascript link", "Run javascript:alert(1)"],
    ["uppercase link", "HTTPS://EXAMPLE.COM"],
  ])("rejects a %s in the detail", (_l, detail) => {
    expect(errorsFor(step({ detail })).join()).toContain("contains a link");
  });
  it("rejects a link in the title", () => {
    expect(errorsFor(step({ title: "Open https://example.com" })).join()).toContain("contains a link");
  });
  it.each([
    ["a control character", "bad\u0007text"],
    ["a newline", "two\nlines"],
    ["a zero-width space", "zero​width"],
    ["a bidi override", "bidi‮text"],
    ["a byte-order mark", "bom﻿text"],
  ])("rejects %s", (_l, detail) => {
    expect(errorsFor(step({ detail })).join()).toContain("control or direction-override");
  });
  it("allows ordinary punctuation and typographic quotes", () => {
    expect(errorsFor(step({ detail: "Use the client’s name (exactly as shown); then run it." }))).toEqual([]);
  });
});

describe("relevance rules", () => {
  it("rejects an industry anchor with no industry (a role alone never anchors a package)", () => {
    const w = block({
      audience: audience({ anchor: "industry", industries: [], roles: ["owner"] }),
      provider: undefined,
      install: "suggest_only",
    });
    expect(errorsFor(w).join()).toContain("an `industry` anchor needs at least one industry");
  });
  it("rejects a tool anchor without a provider", () => {
    expect(errorsFor(block({ provider: undefined, install: "suggest_only" })).join()).toContain("needs a provider");
  });
  it("rejects a provider on a non-tool anchor", () => {
    const w = block({ audience: audience({ anchor: "industry" }), install: "suggest_only" });
    expect(errorsFor(w).join()).toContain("must use the `tool` anchor");
  });
  it("rejects a provider tool the Welcome tools question does not offer", () => {
    const w = block({ provider: { group: "accounting", tool: "reckon" } });
    expect(errorsFor(w).join()).toContain('provider.tool "reckon"');
  });
  it("rejects selected_tool without a provider", () => {
    const w = block({ audience: audience({ anchor: "industry" }), provider: undefined });
    expect(errorsFor(w).join()).toContain("`selected_tool` needs a provider");
  });
  it("rejects reviewed_default with a provider", () => {
    expect(errorsFor(block({ install: "reviewed_default" })).join()).toContain("provider-independent");
  });
  it("rejects requireRole without roles", () => {
    const w = block({ audience: audience({ roles: [], requireRole: true }) });
    expect(errorsFor(w).join()).toContain("`requireRole` needs roles");
  });

  describe("cross_industry_default", () => {
    const cid = (a: Rec, o: Rec = {}) =>
      block({
        audience: { anchor: "cross_industry_default", roles: ["owner"], requireRole: true, ...a },
        provider: undefined,
        install: "reviewed_default",
        ...o,
      });
    it("must be a reviewed default", () => {
      expect(errorsFor(cid({}, { install: "suggest_only" })).join()).toContain("must be a reviewed default");
    });
    it("names no industries", () => {
      expect(errorsFor(cid({ industries: ["retail"] })).join()).toContain("names no industries");
    });
    it("needs roles", () => {
      expect(errorsFor(cid({ roles: [], requireRole: false })).join()).toContain("must require one of its roles");
    });
    it("must require the role", () => {
      expect(errorsFor(cid({ requireRole: false })).join()).toContain("must require one of its roles");
    });
  });

  it("shared credentials force suggest_only", () => {
    expect(errorsFor(block({ credentials: "shared" })).join()).toContain("shared credentials is `suggest_only`");
    const ok = block({ credentials: "shared", install: "suggest_only", audience: audience({ anchor: "industry" }), provider: undefined });
    expect(errorsFor(ok)).toEqual([]);
  });
});

describe("audience ids the Welcome questions offer", () => {
  // An id Welcome never asks about would validate and then silently never match.
  const industryOnly = (a: Rec) => block({ audience: audience({ anchor: "industry", industries: ["retail"], ...a }), provider: undefined, install: "suggest_only" });
  it("accepts every base industry, role, business type and need", () => {
    const w = industryOnly({
      industries: ["bookkeeping", "trades", "retail", "professional", "health", "real_estate", "creative"],
      roles: ["owner", "manager", "bookkeeper", "admin", "marketing", "operations"],
      businessTypes: ["sole_trader", "micro", "small", "medium", "not_for_profit", "association", "employee"],
      needs: ["save_time", "reduce_errors", "grow_revenue", "not_sure"],
    });
    expect(errorsFor(w)).toEqual([]);
  });
  it.each([
    ["industries", { industries: ["realestate"] }, 'industry "realestate"'],
    ["roles", { roles: ["founder"] }, 'role "founder"'],
    ["businessTypes", { businessTypes: ["solo"] }, 'business type "solo"'],
    ["needs", { needs: ["save_money"] }, 'need "save_money"'],
  ] as const)("rejects an unknown id in %s", (_key, a, message) => {
    expect(errorsFor(industryOnly(a)).join()).toContain(message);
  });
});

describe("contradictions with the entry and package", () => {
  it("rejects cost free when the listing shows a price", () => {
    const priced = { listing: { agent: { priceDisplay: "$49 / month" } } };
    expect(errorsFor(block(), priced).join()).toContain("cost is free but the listing shows a price");
    expect(errorsFor(block({ cost: "usage" }), { listing: { agent: { usageDisplay: "per run" } } })).toEqual([]);
    expect(errorsFor(block({ cost: "paid" }), priced)).toEqual([]);
  });
  it("ignores a blank price display", () => {
    expect(errorsFor(block(), { listing: { agent: { priceDisplay: "  " } } })).toEqual([]);
  });

  it("requires auth to equal the entry's connection.authType", () => {
    expect(errorsFor(block({ auth: "oauth" }), { connection: { authType: "api_key" } }).join()).toContain(
      "connection.authType is api_key",
    );
    expect(errorsFor(block({ auth: "api_key", credentials: "per_user" }), { connection: { authType: "api_key" } })).toEqual([]);
  });
  it("lets connection.authType none stand even when MCP servers ship", () => {
    expect(errorsFor(block({ auth: "none" }), { connection: { authType: "none" } })).toEqual([]);
  });
  it("ignores a connection.authType myHub would not read", () => {
    expect(errorsFor(block({ auth: "oauth" }), { connection: { authType: "kerberos" } })).toEqual([]);
  });
  it("rejects auth none when the package ships connectors and the entry has no connection", () => {
    expect(errorsFor(block({ auth: "none" })).join()).toContain("auth is none but the package ships connectors");
  });
  it("counts a .mcp.json as connectors even when it lists no servers, as myHub's catalogue sync does", () => {
    expect(errorsFor(block({ auth: "none" }), {}, pluginDir({ mcp: "empty" })).join()).toContain("ships connectors");
    expect(errorsFor(block({ auth: "oauth" }), {}, pluginDir({ mcp: "empty" }))).toEqual([]);
  });
  it("counts servers listed inline on the entry as connectors", () => {
    const inline = { mcpServers: { acct: { type: "http", url: "https://example.com/mcp" } } };
    expect(errorsFor(block({ auth: "none" }), inline, pluginDir({ mcp: "absent" })).join()).toContain("ships connectors");
    expect(errorsFor(block({ auth: "oauth" }), inline, pluginDir({ mcp: "absent" }))).toEqual([]);
  });
  it("rejects auth other than none when the package ships no connectors", () => {
    expect(errorsFor(block({ auth: "oauth" }), {}, pluginDir({ mcp: "absent" })).join()).toContain("ships no connectors");
    expect(errorsFor(block({ auth: "oauth" }), { mcpServers: {} }, pluginDir({ mcp: "absent" })).join()).toContain("ships no connectors");
    expect(errorsFor(block({ auth: "none" }), {}, pluginDir({ mcp: "absent" }))).toEqual([]);
  });

  it("with no connection on the entry, requires auth to equal plugin.json connection.authType", () => {
    // The store reads the entry; the package's own plugin.json is what Connect actually does.
    expect(errorsFor(block({ auth: "api_key" }), {}, pluginDir({ pluginAuth: "oauth" })).join()).toContain(
      "auth is api_key but plugin.json connection.authType is oauth",
    );
    expect(errorsFor(block(), {}, pluginDir({ pluginAuth: "oauth" }))).toEqual([]);
  });
  it("with no connection on the entry, plugin.json auth none cannot stand beside shipped connectors", () => {
    // myHub reads only the entry: there, auth none next to connectors is a contradiction.
    expect(errorsFor(block({ auth: "none" }), {}, pluginDir({ pluginAuth: "none" })).join()).toContain(
      "auth is none but the package ships connectors",
    );
    expect(errorsFor(block({ auth: "none" }), {}, pluginDir({ pluginAuth: "none", mcp: "absent" }))).toEqual([]);
  });
  it("the entry's connection wins over plugin.json when both are set", () => {
    expect(errorsFor(block(), { connection: { authType: "oauth" } }, pluginDir({ pluginAuth: "api_key" }))).toEqual([]);
  });
  it("requires dependencies to equal the entry's declared dependencies", () => {
    expect(errorsFor(block({ dependencies: ["other"] })).join()).toContain("differ from the entry's declared dependencies");
    expect(errorsFor(block(), { dependencies: [{ plugin: "other" }] }).join()).toContain("differ");
    expect(errorsFor(block({ dependencies: ["b", "a"] }), { dependencies: [{ plugin: "a" }, { plugin: "b" }] })).toEqual([]);
  });

  it("rejects a primaryTile that is not one of the package's widgets", () => {
    const dir = pluginDir({ widgets: ["pkg-jobs"] });
    expect(errorsFor(block({ primaryTile: "pkg-missing" }), {}, dir).join()).toContain("not one of the package's widgets");
    expect(errorsFor(block({ primaryTile: "pkg-jobs" }), {}, pluginDir()).join()).toContain("not one of the package's widgets");
  });
  it("reads tiles from the directory the entry's `widgets` names", () => {
    const dir = pluginDir({ widgets: ["pkg-jobs"], widgetsDir: "tiles" });
    expect(errorsFor(block({ primaryTile: "pkg-jobs" }), { widgets: "./tiles/" }, dir)).toEqual([]);
    expect(errorsFor(block({ primaryTile: "pkg-jobs" }), {}, dir).join()).toContain("not one of the package's widgets");
  });
});

describe("the real marketplace.json", () => {
  const marketplace = JSON.parse(readFileSync(join(repoRoot, ".claude-plugin", "marketplace.json"), "utf8")) as {
    plugins: Rec[];
  };
  const withWelcome = marketplace.plugins.filter((p) => "welcome" in p);

  it("carries Welcome metadata for the three bookkeeping packages", () => {
    const names = withWelcome.map((p) => p.name);
    expect(names).toEqual(expect.arrayContaining(["bookkeeping-xero", "bookkeeping-myob", "bookkeeping-quickbooks"]));
  });

  it.each(withWelcome.map((p) => [p.name as string, p] as const))("%s validates", (name, p) => {
    const source = String(p.source).replace(/^\.\//, "");
    expect(validateWelcomeMetadata(p, join(repoRoot, source)), name).toEqual([]);
  });

  it("never anchors a package on a role alone and never marks a shared-credential package installable", () => {
    for (const p of withWelcome) {
      const w = p.welcome as { audience: { anchor: string; industries: string[] }; credentials: string; install: string };
      if (w.audience.anchor === "industry") expect(w.audience.industries.length, String(p.name)).toBeGreaterThan(0);
      if (w.credentials === "shared") expect(w.install, String(p.name)).toBe("suggest_only");
    }
  });

  it("does not add Welcome metadata to test or demo packages", () => {
    for (const p of withWelcome) expect(String(p.name)).not.toMatch(/test|demo/);
  });
});
