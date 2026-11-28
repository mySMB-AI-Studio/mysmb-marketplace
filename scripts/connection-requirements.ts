/**
 * Connection requirements validator.
 *
 * A marketplace.json entry may carry a top-level `connectionRequirements` block saying
 * which of its connections a person actually owes (see the myHub app's
 * packages/shared/src/onboarding/connection-requirements.ts, the authoritative parser,
 * which this file mirrors rule for rule). Without it, myHub's setup guidance treats
 * EVERY server a package ships as owed — so an optional connector (a shared Outlook
 * mailbox, say) keeps the package "not connected" for everyone who does not use it.
 *
 *   required — servers every person connects;
 *   choices  — at most one question ("Which mailbox receives your bills?"). Each option
 *              names at most one server it needs, the package that ships it (absent: this
 *              one), the automation that reads it, whether that automation reads the
 *              signed-in account or a mailbox set in the package's setup (`reads`), and
 *              optionally the Welcome `tools` answer it stands for (`providerDefault`).
 *   groups   — "at least `min` of these" (Xero, MYOB or QuickBooks; Microsoft 365's
 *              independent features). Each option is one or more servers (of this package,
 *              or of `package`) and counts once all of them are usable; nobody picks — any
 *              option the person connects counts, the rest stay optional. Added without a
 *              schema bump: an older myHub build rejects the unknown key and falls back to
 *              "every server is owed", never to "nothing is owed".
 *
 * myHub ignores a malformed block (every server stays owed). This validator catches it at
 * publish time, and checks what myHub cannot: every own server is in the package's
 * `.mcp.json`, every other package exists here and ships the server named, and every
 * automation exists in the package with the name the block gives it.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const optionId = z.string().regex(/^[a-z0-9_]{1,40}$/, "expected a stable option id");
const pluginName = z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/, "expected a package name");
const serverName = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/, "expected a server name");

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

const optionSchema = z
  .object({
    id: optionId,
    label: plainText(60),
    provider: optionId.optional(),
    providerDefault: z.boolean().default(false),
    server: serverName.optional(),
    package: pluginName.optional(),
    automation: z.object({ originKey: z.string().uuid(), name: plainText(80) }).strict().optional(),
    /** `configured_mailbox`: its automation reads a mailbox set in the package's setup (a shared mailbox), not the signed-in account. */
    reads: z.enum(["connected_account", "configured_mailbox"]).default("connected_account"),
  })
  .strict();

const groupSchema = z
  .object({
    id: optionId,
    label: plainText(80),
    min: z.number().int().min(1).max(12).default(1),
    options: z
      .array(
        z
          .object({ id: optionId, label: plainText(60), servers: z.array(serverName).min(1).max(8), package: pluginName.optional() })
          .strict(),
      )
      .min(2)
      .max(12),
  })
  .strict();

const requirementsSchema = z
  .object({
    schema: z.literal(1),
    required: z.array(serverName).max(8),
    choices: z
      .array(z.object({ id: optionId, question: plainText(120), options: z.array(optionSchema).min(2).max(6) }).strict())
      .max(1)
      .default([]),
    groups: z.array(groupSchema).max(2).default([]),
  })
  .strict()
  .superRefine((r, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: "custom", message });
    if (new Set(r.choices.map((c) => c.id)).size !== r.choices.length) issue("choice ids must be unique");
    if (new Set(r.groups.map((g) => g.id)).size !== r.groups.length) issue("group ids must be unique");
    // One server, one role: required, a choice's option, or one group option — never two.
    const named = [...r.required, ...r.choices.flatMap((c) => c.options.flatMap((o) => (o.server ? [o.server] : [])))];
    for (const g of r.groups) {
      if (new Set(g.options.map((o) => o.id)).size !== g.options.length) issue(`group "${g.id}": option ids must be unique`);
      if (g.min > g.options.length) issue(`group "${g.id}": needs ${g.min} of only ${g.options.length} options`);
      for (const o of g.options) {
        for (const server of o.servers) {
          if (named.includes(server)) issue(`group "${g.id}": option "${o.id}" names "${server}", which is already named`);
          named.push(server);
        }
      }
    }
    for (const choice of r.choices) {
      if (new Set(choice.options.map((o) => o.id)).size !== choice.options.length) {
        issue(`choice "${choice.id}": option ids must be unique`);
      }
      const defaults = new Map<string, number>();
      for (const o of choice.options) {
        if (o.providerDefault && !o.provider) issue(`choice "${choice.id}": option "${o.id}" is a provider default without a provider`);
        if (o.package && !o.server) issue(`choice "${choice.id}": option "${o.id}" names a package but no server`);
        if (o.provider && o.providerDefault) defaults.set(o.provider, (defaults.get(o.provider) ?? 0) + 1);
        if (o.server && r.required.includes(o.server)) {
          issue(`choice "${choice.id}": option "${o.id}" needs "${o.server}", which is already required`);
        }
      }
      for (const [provider, count] of defaults) {
        if (count > 1) issue(`choice "${choice.id}": provider "${provider}" has ${count} default options`);
      }
    }
  });

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

/** Server names in a plugin dir's `.mcp.json` (what myHub's catalogue sync records). */
function shippedServers(pluginDir: string): Set<string> {
  const mcp = readJson(join(pluginDir, ".mcp.json"));
  return new Set(isRecord(mcp) && isRecord(mcp.mcpServers) ? Object.keys(mcp.mcpServers) : []);
}

/** originKey → name of every automation content file in the plugin. */
function automations(pluginDir: string): Map<string, string> {
  const dir = join(pluginDir, "content", "automations");
  const out = new Map<string, string>();
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".json"))) {
    const a = readJson(join(dir, f));
    if (isRecord(a) && typeof a.originKey === "string" && typeof a.name === "string") out.set(a.originKey, a.name);
  }
  return out;
}

/**
 * Errors for one entry's `connectionRequirements` (empty = valid). Callers only invoke
 * this for entries that HAVE the key. `pluginDirOf` resolves another package's directory
 * from its marketplace name (null: no such entry).
 */
export function validateConnectionRequirements(
  entry: Record<string, unknown>,
  pluginDir: string,
  pluginDirOf: (name: string) => string | null,
): string[] {
  const parsed = requirementsSchema.safeParse(entry.connectionRequirements);
  if (!parsed.success) {
    return parsed.error.issues.map((i) => `${i.path.length ? i.path.join(".") : "connectionRequirements"}: ${i.message}`);
  }
  const r = parsed.data;
  const errors: string[] = [];
  const own = shippedServers(pluginDir);
  for (const server of r.required) {
    if (!own.has(server)) errors.push(`required server "${server}" is not in the package's .mcp.json`);
  }
  const ownAutomations = automations(pluginDir);
  for (const choice of r.choices) {
    for (const o of choice.options) {
      if (o.server) {
        if (!o.package || o.package === entry.name) {
          if (!own.has(o.server)) errors.push(`option "${o.id}": server "${o.server}" is not in the package's .mcp.json`);
        } else {
          const dir = pluginDirOf(o.package);
          if (dir === null) errors.push(`option "${o.id}": package "${o.package}" is not in marketplace.json`);
          else if (!shippedServers(dir).has(o.server)) {
            errors.push(`option "${o.id}": package "${o.package}" does not ship server "${o.server}"`);
          }
        }
      }
      if (o.automation) {
        const name = ownAutomations.get(o.automation.originKey);
        if (name === undefined) errors.push(`option "${o.id}": automation ${o.automation.originKey} is not in the package`);
        else if (name !== o.automation.name) {
          errors.push(`option "${o.id}": automation ${o.automation.originKey} is named "${name}", not "${o.automation.name}"`);
        }
      }
    }
  }
  for (const g of r.groups) {
    for (const o of g.options) {
      const where = `group "${g.id}" option "${o.id}"`;
      if (!o.package || o.package === entry.name) {
        for (const server of o.servers) {
          if (!own.has(server)) errors.push(`${where}: server "${server}" is not in the package's .mcp.json`);
        }
        continue;
      }
      const dir = pluginDirOf(o.package);
      if (dir === null) {
        errors.push(`${where}: package "${o.package}" is not in marketplace.json`);
        continue;
      }
      const theirs = shippedServers(dir);
      for (const server of o.servers) {
        if (!theirs.has(server)) errors.push(`${where}: package "${o.package}" does not ship server "${server}"`);
      }
    }
  }
  return errors;
}
