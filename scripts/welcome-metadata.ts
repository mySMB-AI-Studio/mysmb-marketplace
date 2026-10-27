/**
 * Welcome metadata validator.
 *
 * A marketplace.json entry may carry a top-level `welcome` block describing who the
 * package is for (see the myHub app's packages/shared/src/onboarding/welcome-metadata.ts,
 * the authoritative parser, which this file mirrors rule for rule). myHub fails closed on
 * a malformed or contradictory block: the package is simply not offered at Welcome. This
 * validator catches those failures at publish time instead.
 *
 * Two layers, like the parser:
 *   1. Shape: strict object, option ids, plain-text setup steps, anchor / install /
 *      credentials rules.
 *   2. Cross-checks against the entry itself and the package directory: price, connection
 *      auth, shipped MCP servers, declared dependencies and the widgets the package ships.
 *
 * Relevance policy: a broad role alone never anchors a package. Anchors are an industry,
 * a named tool, or (for a reviewed default) a role the maintainers explicitly require.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

/** Option ids of the myHub base `tools` Welcome question. Any other tool is never offered. */
export const WELCOME_BASE_TOOLS = ["m365", "google", "xero", "myob", "quickbooks", "canva", "slack"] as const;
/**
 * Option ids of the other base Welcome questions (myHub packages/shared/src/onboarding/schema.ts).
 * An audience id Welcome never asks about validates as a slug and then silently never matches.
 */
export const WELCOME_BASE_OPTIONS = {
  industries: ["bookkeeping", "trades", "retail", "professional", "health", "real_estate", "creative"],
  roles: ["owner", "manager", "bookkeeper", "admin", "marketing", "operations"],
  businessTypes: ["sole_trader", "micro", "small", "medium", "not_for_profit", "association", "employee"],
  needs: ["save_time", "reduce_errors", "grow_revenue", "not_sure"],
} as const;
const OPTION_NOUN = { industries: "industry", roles: "role", businessTypes: "business type", needs: "need" } as const;

const optionId = z.string().regex(/^[a-z0-9_]{1,40}$/, "expected a stable option id");
const widgetId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,119}$/, "expected a widget id");
const pluginName = z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/, "expected a package name");

// Plain text only: no links, no control, zero-width or bidi-override characters.
const UNSAFE_TEXT = /[\u0000-\u001F\u007F-\u009F​-‏‪-‮⁦-⁩﻿]/;
const LINK = /\b(?:https?:|www\.|mailto:|javascript:)/i;
const plainText = (max: number) =>
  z
    .string()
    .min(1)
    .max(max)
    .refine((t) => !UNSAFE_TEXT.test(t), "contains control or direction-override characters")
    .refine((t) => !LINK.test(t), "contains a link");

const setupStepSchema = z
  .object({
    kind: z.enum(["connect", "configure", "review_automations", "learn"]),
    title: plainText(80),
    detail: plainText(240).optional(),
  })
  .strict();

const welcomeSchema = z
  .object({
    schema: z.literal(1),
    audience: z
      .object({
        anchor: z.enum(["industry", "tool", "cross_industry_default"]),
        industries: z.array(optionId).max(16).default([]),
        roles: z.array(optionId).max(16).default([]),
        requireRole: z.boolean().default(false),
        businessTypes: z.array(optionId).max(16).default([]),
        needs: z.array(optionId).max(8).default([]),
      })
      .strict(),
    provider: z.object({ group: optionId, tool: optionId }).strict().optional(),
    install: z.enum(["selected_tool", "reviewed_default", "suggest_only"]),
    cost: z.enum(["free", "paid", "usage"]),
    auth: z.enum(["none", "oauth", "oauth_client", "api_key"]),
    credentials: z.enum(["per_user", "shared"]),
    dependencies: z.array(pluginName).max(20),
    setup: z.object({ steps: z.array(setupStepSchema).min(1).max(8) }).strict().optional(),
    primaryTile: widgetId.optional(),
  })
  .strict()
  .superRefine((m, ctx) => {
    const a = m.audience;
    const issue = (message: string) => ctx.addIssue({ code: "custom", message });
    if (a.anchor === "industry" && a.industries.length === 0) issue("an `industry` anchor needs at least one industry");
    if (a.anchor === "tool" && !m.provider) issue("a `tool` anchor needs a provider");
    if (a.anchor !== "tool" && m.provider) issue("a provider package must use the `tool` anchor");
    if (a.anchor === "cross_industry_default") {
      if (m.install !== "reviewed_default") issue("a `cross_industry_default` must be a reviewed default");
      if (a.industries.length > 0) issue("a `cross_industry_default` names no industries");
      if (a.roles.length === 0 || !a.requireRole) issue("a `cross_industry_default` must require one of its roles");
    }
    if (a.requireRole && a.roles.length === 0) issue("`requireRole` needs roles");
    if (m.credentials === "shared" && m.install !== "suggest_only") issue("a package with shared credentials is `suggest_only`");
    if (m.install === "selected_tool" && !m.provider) issue("`selected_tool` needs a provider");
    if (m.install === "reviewed_default" && m.provider) issue("`reviewed_default` must be provider-independent");
    for (const key of Object.keys(WELCOME_BASE_OPTIONS) as Array<keyof typeof WELCOME_BASE_OPTIONS>) {
      const offered: readonly string[] = WELCOME_BASE_OPTIONS[key];
      for (const id of a[key]) {
        if (!offered.includes(id)) {
          issue(`audience ${OPTION_NOUN[key]} "${id}" is not an option of the Welcome question (${offered.join(", ")}); myHub would never match it`);
        }
      }
    }
    if (m.provider && !(WELCOME_BASE_TOOLS as readonly string[]).includes(m.provider.tool)) {
      issue(
        `provider.tool "${m.provider.tool}" is not an option of the Welcome tools question (${WELCOME_BASE_TOOLS.join(", ")}); myHub would never match it`,
      );
    }
  });

export type WelcomeMetadata = z.infer<typeof welcomeSchema>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function isPriced(entry: Record<string, unknown>): boolean {
  const agent = isRecord(entry.listing) && isRecord(entry.listing.agent) ? entry.listing.agent : null;
  const set = (v: unknown) => typeof v === "string" && v.trim().length > 0;
  return agent !== null && (set(agent.priceDisplay) || set(agent.usageDisplay));
}

/** A manifest's `connection.authType` (the entry's, as `toExtensionListing` derives `connectionAuth`; or plugin.json's). */
function connectionAuth(entry: unknown): string | null {
  const authType = isRecord(entry) && isRecord(entry.connection) ? entry.connection.authType : undefined;
  return authType === "oauth" || authType === "oauth_client" || authType === "api_key" || authType === "none"
    ? authType
    : null;
}

function declaredDependencies(entry: Record<string, unknown>): string[] {
  return Array.isArray(entry.dependencies)
    ? entry.dependencies.flatMap((d) => (isRecord(d) && typeof d.plugin === "string" ? [d.plugin] : []))
    : [];
}

/**
 * Whether myHub's catalogue sync records connectors for the package
 * (summarizeComponentsFromTree): servers listed inline on the entry, or a `.mcp.json`
 * in the bundle at all — even one listing no servers.
 */
function shipsConnectors(entry: Record<string, unknown>, pluginDir: string): boolean {
  if (isRecord(entry.mcpServers) && Object.keys(entry.mcpServers).length > 0) return true;
  return existsSync(join(pluginDir, ".mcp.json"));
}

/** Tile ids as myHub's catalogue sync derives them: `*.json` directly in the entry's `widgets` dir. */
function tileIds(entry: Record<string, unknown>, pluginDir: string): string[] {
  const named = typeof entry.widgets === "string" && entry.widgets.length > 0 ? entry.widgets : "widgets";
  const dir = join(pluginDir, named.replace(/^\.\//, "").replace(/\/+$/, ""));
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return [];
  return readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".json") && statSync(join(dir, f)).isFile())
    .map((f) => f.slice(0, -".json".length));
}

/**
 * Errors for one marketplace entry's `welcome` block (empty = valid). Callers only invoke
 * this for entries that HAVE a `welcome` key; an entry without one is unaffected.
 */
export function validateWelcomeMetadata(entry: Record<string, unknown>, pluginDir: string): string[] {
  const block = entry.welcome;
  if (isRecord(block) && block.schema !== undefined && block.schema !== 1) {
    return [`welcome.schema ${String(block.schema)} is not supported (only 1)`];
  }
  const parsed = welcomeSchema.safeParse(block);
  if (!parsed.success) {
    return parsed.error.issues.map((i) => `${i.path.length ? i.path.join(".") : "welcome"}: ${i.message}`);
  }
  const m = parsed.data;
  const errors: string[] = [];

  if (m.cost === "free" && isPriced(entry)) errors.push("cost is free but the listing shows a price");

  // myHub's rule, exactly: the entry's connection.authType, else whether connectors ship.
  const entryAuth = connectionAuth(entry);
  if (entryAuth !== null) {
    if (m.auth !== entryAuth) errors.push(`auth is ${m.auth} but the entry's connection.authType is ${entryAuth}`);
  } else {
    if (shipsConnectors(entry, pluginDir)) {
      if (m.auth === "none") errors.push("auth is none but the package ships connectors (.mcp.json or mcpServers)");
    } else if (m.auth !== "none") {
      errors.push(`auth is ${m.auth} but the package ships no connectors`);
    }
    // Stricter than myHub, which reads only the entry: plugin.json is what Connect does.
    const packageAuth = connectionAuth(readJson(join(pluginDir, ".claude-plugin", "plugin.json")));
    if (packageAuth !== null && m.auth !== packageAuth) {
      errors.push(`auth is ${m.auth} but plugin.json connection.authType is ${packageAuth}`);
    }
  }

  const declared = [...new Set(declaredDependencies(entry))].sort();
  const stated = [...new Set(m.dependencies)].sort();
  if (declared.join("\n") !== stated.join("\n")) {
    errors.push(
      `dependencies [${stated.join(", ")}] differ from the entry's declared dependencies [${declared.join(", ")}]`,
    );
  }

  if (m.primaryTile && !tileIds(entry, pluginDir).includes(m.primaryTile)) {
    errors.push(`primaryTile "${m.primaryTile}" is not one of the package's widgets/*.json ids`);
  }
  return errors;
}
