#!/usr/bin/env node
/**
 * Validates the mySMB marketplace manifest and every plugin in it.
 *
 * Checks:
 *   1. .claude-plugin/marketplace.json exists and parses.
 *   2. Every plugin listed in marketplace.json has a matching directory.
 *   3. Every plugin dir has .claude-plugin/plugin.json, .mcp.json, README.md.
 *   4. Every MCP server in .mcp.json declares a recognised transport type
 *      ("stdio", "sse", or "http"). Any transport supported by the Claude
 *      Code / Agent SDK MCP client is allowed.
 *   5. Every ${VAR} placeholder in .mcp.json env values (or headers, for
 *      remote transports) is either CLAUDE_PLUGIN_ROOT (reserved) or
 *      documented in the plugin README under a "Configuration" heading.
 *   6. If plugin.json declares a MyHub `content` section (tenant-authored
 *      plugin packaging), every listed content file exists and parses as
 *      JSON, its filename matches the payload's originKey (and its `kind`
 *      matches the section it is listed under), and every automation
 *      dependency resolves to a content entity bundled in the same plugin.
 *      Plugins without a content section are unaffected.
 *   7. If plugin.json declares `briefingEmailSources` (mySidekick briefing
 *      mailboxes), every listed file exists, parses, matches the email-source
 *      schema, belongs to this plugin, names only a server this plugin declares
 *      in .mcp.json, and uses an https compose template with known placeholders.
 *   8. Every widget JSON under a plugin's widgets/ dir is checked for
 *      TILE-DISPLAY-STANDARDS.md §5's "xxs" gap bug (not a real value, silently
 *      renders as zero gap). Mirrors exactly that one rule from the doc — see
 *      the doc's own §14 for why only this rule is mechanically enforced here.
 *      Forward-only (§14's rollout policy): files listed in
 *      scripts/xxs-baseline.json are pre-existing, known violators from the
 *      2026-08-05 audit and are grandfathered — editing this validator does
 *      NOT retroactively fail them. Only a NEW "xxs" usage (a new widget, or
 *      an existing widget not already on the baseline) fails. Retrofitting the
 *      baseline is the separate, deliberately-scoped initiative §14 describes —
 *      remove a file from the baseline once it's actually fixed.
 *   9. Every widget JSON is cross-checked against the servers its plugin
 *      declares in .mcp.json: `connectorsUsed` may only name declared servers,
 *      and every server the spec actually calls (dataProvider.mcp, params.mcp,
 *      `<server>.<tool>` actions, `/<server>/<tool>` state paths and the
 *      reserved `/_loading|_errors|_needsConnection/<server>.<tool>` keys)
 *      must appear in `connectorsUsed`. myHub keys the credential vault, tool
 *      routing and tile seeding on those exact names, so a stale or undeclared
 *      name is a tile that never loads or is gated wrongly. Mandatory — zero
 *      violations existed when it landed. Widget `id` must also equal the
 *      filename stem (dashboards and the first-run wizard hold tiles by id, so
 *      a drifted id is a rename that strands them) — forward-only, with the
 *      pre-existing exceptions grandfathered in scripts/widget-id-baseline.json.
 *
 * Exits 1 on any failure.
 */
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, resolve, dirname, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const errors: string[] = [];
const fail = (msg: string) => errors.push(msg);

const XXS_BASELINE: Set<string> = new Set(
  (JSON.parse(readFileSync(join(__dirname, "xxs-baseline.json"), "utf8")) as string[]).map((p) =>
    p.split("/").join(sep),
  ),
);

/** Widgets whose id already differed from their filename when rule 9 landed. */
const WIDGET_ID_BASELINE: Set<string> = new Set(
  (JSON.parse(readFileSync(join(__dirname, "widget-id-baseline.json"), "utf8")) as string[]).map((p) =>
    p.split("/").join(sep),
  ),
);

const RESERVED_VARS = new Set(["CLAUDE_PLUGIN_ROOT"]);

/**
 * The canonical production myhub-mcp-servers host. Every myhub-hosted plugin
 * `.mcp.json` URL must use this host on ALL branches — staging/dev routing is
 * applied at runtime by myHub (MCP_SERVERS_BASE_URL), never baked into the repo.
 * Overridable via env for a future FQDN change without editing the validator.
 */
const PROD_MCP_HOST =
  process.env.MYHUB_PROD_MCP_HOST ??
  "myhub-mcp-servers.thankfulcliff-9090ceed.westus2.azurecontainerapps.io";

interface MarketplacePlugin {
  name: string;
  source?: string | { type?: string; path?: string; source?: string };
}

interface Marketplace {
  name: string;
  plugins: MarketplacePlugin[];
}

function readJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch (err) {
    fail(`failed to parse ${path}: ${(err as Error).message}`);
    return null;
  }
}

function extractPlaceholders(value: string): string[] {
  const out: string[] = [];
  const re = /\$\{([A-Z0-9_]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value)) !== null) out.push(m[1]);
  return out;
}

/**
 * Accepts either the string shorthand ("./plugins/xero") or the object
 * form ({ type: "path", path: "plugins/xero" } / { source: "./plugins/xero" }).
 * Returns null if the shape is unrecognised.
 */
function resolveSourcePath(
  source: string | { type?: string; path?: string; source?: string } | undefined,
): string | null {
  if (!source) return null;
  if (typeof source === "string") return source;
  if (typeof source === "object") {
    if (typeof source.path === "string") return source.path;
    if (typeof source.source === "string") return source.source;
  }
  return null;
}

function extractConfigVars(readme: string): Set<string> {
  // Find the "Configuration" heading and collect every ALL_CAPS token in that
  // section until the next heading of equal or higher level.
  const lines = readme.split(/\r?\n/);
  const vars = new Set<string>();
  let inSection = false;
  let sectionLevel = 0;
  for (const line of lines) {
    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const title = headingMatch[2].trim().toLowerCase();
      if (!inSection && title === "configuration") {
        inSection = true;
        sectionLevel = level;
        continue;
      }
      if (inSection && level <= sectionLevel) {
        inSection = false;
      }
    }
    if (inSection) {
      const tokenRe = /\b([A-Z][A-Z0-9_]{2,})\b/g;
      let m: RegExpExecArray | null;
      while ((m = tokenRe.exec(line)) !== null) vars.add(m[1]);
    }
  }
  return vars;
}

const ALLOWED_WIDGET_ELEMENT_IMPORTS = new Set([
  "react",
  "lucide-react",
  "zod",
  "@json-render/core",
  "@json-render/react",
  "@myhub/widget-tokens",
]);

function findMatchingBrace(src: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function validateImportAllowlist(pluginDirName: string, filePath: string, src: string) {
  // Match: import ... from "<source>";  OR  import("<source>")
  const importRe = /(?:import\s+(?:[^"';]+?\s+from\s+)?|import\s*\()\s*["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(src)) !== null) {
    const source = m[1];
    if (source.startsWith("./") || source.startsWith("../")) continue;
    if (ALLOWED_WIDGET_ELEMENT_IMPORTS.has(source)) continue;
    fail(
      `plugins/${pluginDirName}: ${filePath} imports "${source}" which is not in the widget-elements allowlist`,
    );
  }
}

function validateActionSchemas(pluginDirName: string, filePath: string, src: string) {
  // Heuristic: if the file declares an "actions:" or "actions =" block, every
  // action object inside (identified by containing a "handler:" key) should
  // also have a "schema:" key. Best-effort regex — this is a build-time gate,
  // not a parser. Plugins without actions are unaffected.
  if (!/\bactions\s*[:=]/.test(src)) return;

  const actionStartRe = /^\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*\{/gm;
  let m: RegExpExecArray | null;
  while ((m = actionStartRe.exec(src)) !== null) {
    const startIdx = m.index + m[0].length - 1;
    const blockEnd = findMatchingBrace(src, startIdx);
    if (blockEnd === -1) continue;
    const block = src.slice(startIdx, blockEnd + 1);
    if (!/\bhandler\s*:/.test(block)) continue;
    if (!/\bschema\s*:/.test(block)) {
      fail(
        `plugins/${pluginDirName}: ${filePath} action "${m[1]}" has no schema field`,
      );
    }
  }
}

/**
 * TILE-DISPLAY-STANDARDS.md §5: "xxs" is not a real gap value — it silently
 * renders as zero gap, identical to "none". Mirrors exactly one rule from that
 * doc; if §5 is ever resolved by promoting "xxs" to a real GAP_SIZE value
 * instead of mass-fixing existing widgets, update this check in the same PR.
 */
function findXxsGaps(value: unknown, path: string, out: string[]) {
  if (Array.isArray(value)) {
    value.forEach((v, i) => findXxsGaps(v, `${path}[${i}]`, out));
  } else if (isRecord(value)) {
    for (const [key, v] of Object.entries(value)) {
      if (key === "gap" && v === "xxs") out.push(path || "(root)");
      else findXxsGaps(v, path ? `${path}.${key}` : key, out);
    }
  }
}

function validateTileDisplayStandards(pluginDirName: string, fileName: string, filePath: string) {
  // Parse locally (not the shared readJson helper) and skip silently on
  // failure — a malformed widget JSON is a pre-existing, unrelated bug this
  // check shouldn't newly start failing PRs over; it's a separate finding.
  let widget: unknown;
  try {
    widget = JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return;
  }
  const hits: string[] = [];
  findXxsGaps(widget, "", hits);
  if (hits.length === 0) return;

  if (XXS_BASELINE.has(relative(repoRoot, filePath))) return; // pre-existing, grandfathered — see §14 rollout note above

  for (const hit of hits) {
    fail(
      `plugins/${pluginDirName}: widgets/${fileName} uses "gap": "xxs" at ${hit} — not a real value (TILE-DISPLAY-STANDARDS.md §5), silently renders as zero gap; use "xs" or "none"`,
    );
  }
}

/** Server names a plugin's .mcp.json declares, or null when it cannot be read (reported elsewhere). */
function readDeclaredServers(pluginDir: string): Set<string> | null {
  try {
    const mcp = JSON.parse(readFileSync(join(pluginDir, ".mcp.json"), "utf8")) as { mcpServers?: unknown };
    return isRecord(mcp.mcpServers) ? new Set(Object.keys(mcp.mcpServers)) : null;
  } catch {
    return null;
  }
}

let knownServersCache: Set<string> | null = null;
/**
 * Every server name any plugin in the marketplace declares. A `/x/...` state
 * path is only treated as a server reference when `x` is one of these —
 * widget-local state (`/selected/...`) is otherwise indistinguishable from a
 * server path — and that is also what catches a stale reference to a server
 * that still exists elsewhere (a legacy name left behind after a widget moved
 * to a combined server).
 */
function allKnownServers(): Set<string> {
  if (knownServersCache) return knownServersCache;
  const out = new Set<string>();
  const pluginsDir = join(repoRoot, "plugins");
  for (const dirName of readdirSync(pluginsDir)) {
    const pluginDir = join(pluginsDir, dirName);
    if (!statSync(pluginDir).isDirectory()) continue;
    for (const name of readDeclaredServers(pluginDir) ?? []) out.add(name);
  }
  knownServersCache = out;
  return out;
}

const RESERVED_STATE_PATH = /^\/(?:_loading|_errors|_needsConnection)\/([^./]+)\.[^/]+/;

/**
 * Every server a widget calls, with the first place it was seen. Looks at the
 * five places a widget names a server (see check 9 in the header). `id`,
 * `title` and `description` are prose and skipped.
 */
function collectWidgetServerRefs(widget: unknown, knownServers: Set<string>): Map<string, string> {
  const refs = new Map<string, string>();
  const note = (server: string, where: string) => {
    if (!refs.has(server)) refs.set(server, where || "(root)");
  };
  const fromPath = (value: string, where: string) => {
    const reserved = RESERVED_STATE_PATH.exec(value);
    if (reserved) {
      note(reserved[1], where);
      return;
    }
    const first = /^\/([^/]+)(?:\/|$)/.exec(value);
    if (first && knownServers.has(first[1])) note(first[1], where);
  };
  const walk = (value: unknown, key: string, where: string) => {
    if (typeof value === "string") {
      if (key === "id" || key === "title" || key === "description") return;
      if (key === "mcp") note(value, where);
      else if (key === "action" && value.includes(".")) {
        const server = value.slice(0, value.indexOf("."));
        if (knownServers.has(server)) note(server, where);
      }
      fromPath(value, where);
    } else if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, key, `${where}[${i}]`));
    } else if (isRecord(value)) {
      for (const [k, v] of Object.entries(value)) {
        const childWhere = where ? `${where}.${k}` : k;
        fromPath(k, childWhere); // `watch` keys are state paths too
        walk(v, k, childWhere);
      }
    }
  };
  walk(widget, "", "");
  return refs;
}

function validateWidgetServerRefs(
  pluginDirName: string,
  fileName: string,
  widget: Record<string, unknown>,
  declaredServers: Set<string>,
) {
  const used = Array.isArray(widget.connectorsUsed)
    ? widget.connectorsUsed.filter((c): c is string => typeof c === "string")
    : [];
  for (const server of used) {
    if (!declaredServers.has(server)) {
      fail(
        `plugins/${pluginDirName}: widgets/${fileName} connectorsUsed names "${server}", which is not a server this plugin declares in .mcp.json`,
      );
    }
  }
  const declaredUsed = new Set(used);
  for (const [server, where] of collectWidgetServerRefs(widget, allKnownServers())) {
    if (declaredUsed.has(server)) continue;
    fail(
      declaredServers.has(server)
        ? `plugins/${pluginDirName}: widgets/${fileName} calls server "${server}" at ${where} but does not list it in connectorsUsed`
        : `plugins/${pluginDirName}: widgets/${fileName} references "${server}" at ${where} — not a server this plugin declares in .mcp.json (stale or foreign server name)`,
    );
  }
}

/**
 * Widget `id` must equal its filename stem. myHub resolves a tile by `id`
 * (dashboards store it; the first-run wizard seeds by it), so an id that
 * drifts from its file is a rename in disguise — every dashboard holding the
 * old id loses the tile. Forward-only like the "xxs" rule: files listed in
 * scripts/widget-id-baseline.json predate this check and are grandfathered.
 */
function validateWidgetId(
  pluginDirName: string,
  fileName: string,
  filePath: string,
  widget: Record<string, unknown>,
) {
  if (typeof widget.id !== "string") return; // myHub defaults the id to the filename stem
  const stem = fileName.replace(/\.json$/, "");
  if (widget.id === stem) return;
  if (WIDGET_ID_BASELINE.has(relative(repoRoot, filePath))) return; // pre-existing, grandfathered
  fail(
    `plugins/${pluginDirName}: widgets/${fileName} has id "${widget.id}" but the filename stem is "${stem}" — dashboards and the first-run wizard hold tiles by id, so a drifted id strands them; rename the file and the id together, deliberately`,
  );
}

function validateWidgetElements(
  pluginDirName: string,
  manifest: { widgetElements?: string; widgets?: string },
) {
  const pluginDir = join(repoRoot, "plugins", pluginDirName);
  const declaredWE = manifest.widgetElements;
  const declaredW = manifest.widgets;

  if (!declaredWE && !declaredW) return;

  // Rule 5: widgetElements requires widgets
  if (declaredWE && !declaredW) {
    fail(
      `plugins/${pluginDirName}: declares widgetElements but not widgets — every plugin shipping elements must ship at least one example widget`,
    );
  }

  // Rule 1: widgetElements file must exist
  if (declaredWE) {
    const filePath = join(pluginDir, declaredWE);
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      fail(
        `plugins/${pluginDirName}: widgetElements declared at "${declaredWE}" but the file is missing`,
      );
    } else {
      const src = readFileSync(filePath, "utf8");
      validateImportAllowlist(pluginDirName, declaredWE, src);
      validateActionSchemas(pluginDirName, declaredWE, src);
    }
  }

  // Rule 4: widgets dir must exist + contain at least one .json
  if (declaredW) {
    const dirPath = join(pluginDir, declaredW);
    if (!existsSync(dirPath) || !statSync(dirPath).isDirectory()) {
      fail(
        `plugins/${pluginDirName}: widgets declared at "${declaredW}" but the directory is missing`,
      );
    } else {
      const files = readdirSync(dirPath);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));
      if (jsonFiles.length === 0) {
        fail(
          `plugins/${pluginDirName}: widgets directory "${declaredW}" must contain at least one *.json file`,
        );
      }
      const declaredServers = readDeclaredServers(pluginDir);
      for (const fileName of jsonFiles) {
        const filePath = join(dirPath, fileName);
        validateTileDisplayStandards(pluginDirName, fileName, filePath);
        // Same policy as the xxs check: a widget that does not parse is a
        // pre-existing, unrelated bug — skip rather than newly fail on it.
        let widget: unknown;
        try {
          widget = JSON.parse(readFileSync(filePath, "utf8"));
        } catch {
          continue;
        }
        if (!isRecord(widget)) continue;
        validateWidgetId(pluginDirName, fileName, filePath, widget);
        if (declaredServers) validateWidgetServerRefs(pluginDirName, fileName, widget, declaredServers);
      }
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// MyHub content section — tenant-authored plugin packaging (2026-07).
// plugin.json may carry a `content` object listing plugin-relative paths of
// DB-backed content files (content/<kind-dir>/<origin-key>.json) that the
// MyHub tenant installer upserts by origin_key. Claude Code ignores the
// section; plugins without one are unaffected. Kept in lock-step with the
// in-app bundle validator in myHubV2:
// packages/shared/src/plugins/authoring/validate.ts (see its parity map).
// ──────────────────────────────────────────────────────────────────────────

type ContentKind = "automation" | "workq_template" | "form_template" | "form" | "agent";

/** plugin.json `content` section key → the `kind` its payloads must carry.
 *  Parity with myHubV2 packages/shared/src/plugins/authoring/validate.ts —
 *  `agents` was missing here (added with the myconnect-builder 0.3.0 runner
 *  hints), so agent payloads were never checked by this validator. */
const CONTENT_SECTION_KINDS: Record<string, ContentKind> = {
  automations: "automation",
  workqTemplates: "workq_template",
  formTemplates: "form_template",
  forms: "form",
  agents: "agent",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateContent(pluginDirName: string, content: unknown) {
  if (!isRecord(content)) {
    fail(`plugins/${pluginDirName}: plugin.json content section must be an object`);
    return;
  }
  const pluginDir = join(repoRoot, "plugins", pluginDirName);

  /** kind → originKeys of every payload that parsed (dependency targets). */
  const bundledByKind = new Map<ContentKind, Set<string>>();
  /** Parsed automation payloads, revisited for the dependency check. */
  const automationPayloads: Array<{
    entry: string;
    payload: Record<string, unknown>;
  }> = [];

  for (const [section, expectedKind] of Object.entries(CONTENT_SECTION_KINDS)) {
    const listed = content[section];
    if (listed === undefined) continue;
    if (!Array.isArray(listed)) {
      fail(
        `plugins/${pluginDirName}: plugin.json content.${section} must be an array of paths`,
      );
      continue;
    }
    for (const entry of listed) {
      if (typeof entry !== "string") {
        fail(
          `plugins/${pluginDirName}: plugin.json content.${section} has a non-string entry`,
        );
        continue;
      }
      const filePath = join(pluginDir, entry);
      if (!existsSync(filePath) || !statSync(filePath).isFile()) {
        fail(
          `plugins/${pluginDirName}: content file "${entry}" listed in plugin.json is missing`,
        );
        continue;
      }
      const payload = readJson<unknown>(filePath);
      if (payload === null) continue; // readJson already reported the parse failure
      if (!isRecord(payload)) {
        fail(`plugins/${pluginDirName}: ${entry} content payload must be a JSON object`);
        continue;
      }
      if (payload.kind !== expectedKind) {
        fail(
          `plugins/${pluginDirName}: ${entry} payload kind "${String(payload.kind)}" does not match its plugin.json section "${section}" (expected "${expectedKind}")`,
        );
      }
      const originKey = typeof payload.originKey === "string" ? payload.originKey : null;
      const fileBase = entry.slice(entry.lastIndexOf("/") + 1).replace(/\.json$/, "");
      if (originKey === null || originKey !== fileBase) {
        fail(
          `plugins/${pluginDirName}: ${entry} filename "${fileBase}" does not match the payload originKey "${String(payload.originKey)}"`,
        );
      }
      if (originKey !== null) {
        const keys = bundledByKind.get(expectedKind) ?? new Set<string>();
        keys.add(originKey);
        bundledByKind.set(expectedKind, keys);
      }
      if (expectedKind === "automation") automationPayloads.push({ entry, payload });
    }
  }

  // Automations' declared dependencies must resolve inside the same plugin —
  // the MyHub installer upserts forms/templates first, then remaps the
  // automation IR by originKey; a dangling key would leave the automation
  // broken on install.
  const allKeys = new Set<string>([...bundledByKind.values()].flatMap((s) => [...s]));
  for (const { entry, payload } of automationPayloads) {
    if (!Array.isArray(payload.dependencies)) continue;
    for (const dep of payload.dependencies) {
      if (!isRecord(dep) || typeof dep.originKey !== "string") continue;
      const entityKind = typeof dep.entityKind === "string" ? dep.entityKind : "";
      const kindSet = (Object.values(CONTENT_SECTION_KINDS) as string[]).includes(
        entityKind,
      )
        ? (bundledByKind.get(entityKind as ContentKind) ?? new Set<string>())
        : allKeys;
      if (!kindSet.has(dep.originKey)) {
        fail(
          `plugins/${pluginDirName}: ${entry} automation dependency ${entityKind || "entity"} ${dep.originKey} is not bundled — add it to the plugin (dangling reference)`,
        );
      }
    }
  }
}


// ── Briefing email sources ────────────────────────────────────────────────────
//
// A plugin that exposes a mailbox to the mySidekick morning briefing declares
// `briefingEmailSources` in plugin.json, pointing at JSON files that describe
// which MCP tool to call and how to project its rows.
//
// This is a higher-stakes contract than a widget: at runtime the briefing
// invokes the named server with the user's live mail credential. So the file is
// checked here, in CI, rather than being discovered as a silently missing
// mailbox at 8am. The authoritative schema lives in myHubV2
// (packages/shared/src/briefing-sources/email-source-schema.ts); this mirrors
// its structural rules so the marketplace can be validated standalone.

const EMAIL_MESSAGE_FIELDS = new Set([
  "id",
  "fromName",
  "fromAddress",
  "subject",
  "snippet",
  "receivedAt",
  "isUnread",
]);
const REQUIRED_EMAIL_FIELDS = ["id", "fromAddress", "receivedAt"];
const EMAIL_TRANSFORMS = new Set([
  "mailbox-name",
  "mailbox-address",
  "unix-ms-to-iso",
  "iso-date",
  "boolean-not",
]);
const COMPOSE_PLACEHOLDERS = new Set(["to", "subject", "body", "accountAddress"]);
const DOT_PATH_RE = /^[a-zA-Z0-9_$-]+(\.[a-zA-Z0-9_$-]+)*$/;



function validateBriefingEmailSources(
  pluginDirName: string,
  declared: unknown,
  ownedServers: Set<string>,
) {
  const where = `plugins/${pluginDirName}`;
  if (!Array.isArray(declared)) {
    fail(`${where}: plugin.json briefingEmailSources must be an array of paths`);
    return;
  }

  const pluginDir = join(repoRoot, "plugins", pluginDirName);

  for (const entry of declared) {
    if (typeof entry !== "string") {
      fail(`${where}: briefingEmailSources has a non-string entry`);
      continue;
    }
    // Path containment: a declared path must not escape the plugin directory,
    // or one plugin could serve another's source file and borrow its credential.
    const filePath = resolve(pluginDir, entry);
    if (filePath !== pluginDir && !filePath.startsWith(pluginDir + "/")) {
      fail(`${where}: briefingEmailSources entry "${entry}" escapes the plugin directory`);
      continue;
    }
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      fail(`${where}: briefingEmailSources entry "${entry}" is missing`);
      continue;
    }
    const src = readJson<Record<string, unknown>>(filePath);
    if (src === null) continue; // readJson already reported the parse failure
    if (!isRecord(src)) {
      fail(`${where}: ${entry} must be a JSON object`);
      continue;
    }

    if (src.canonical !== "email/Message") {
      fail(`${where}: ${entry} canonical must be "email/Message"`);
    }
    if (src.plugin !== pluginDirName) {
      fail(`${where}: ${entry} declares plugin "${String(src.plugin)}", expected "${pluginDirName}"`);
    }
    if (typeof src.id !== "string" || !src.id.startsWith(`${pluginDirName}/`)) {
      fail(`${where}: ${entry} id "${String(src.id)}" must start with "${pluginDirName}/"`);
    }

    const provider = src.provider;
    if (!isRecord(provider) || typeof provider.key !== "string" || typeof provider.label !== "string") {
      fail(`${where}: ${entry} provider must be { key, label }`);
    }

    const source = src.source;
    if (!isRecord(source) || typeof source.mcpServer !== "string" || typeof source.tool !== "string") {
      fail(`${where}: ${entry} source must be { mcpServer, tool }`);
    } else {
      if (!ownedServers.has(source.mcpServer)) {
        fail(
          `${where}: ${entry} names MCP server "${source.mcpServer}", which this plugin does not declare in .mcp.json`,
        );
      }
      if (source.itemsPath !== undefined && (typeof source.itemsPath !== "string" || !DOT_PATH_RE.test(source.itemsPath))) {
        fail(`${where}: ${entry} source.itemsPath must be a dot-path`);
      }
    }

    const projection = src.fieldProjection;
    if (!Array.isArray(projection) || projection.length === 0) {
      fail(`${where}: ${entry} fieldProjection must be a non-empty array`);
    } else {
      const produced = new Set<string>();
      for (const rule of projection) {
        if (!isRecord(rule) || typeof rule.out !== "string" || !EMAIL_MESSAGE_FIELDS.has(rule.out)) {
          fail(`${where}: ${entry} fieldProjection has a rule with an unknown "out" field`);
          continue;
        }
        if (produced.has(rule.out)) {
          fail(`${where}: ${entry} fieldProjection produces "${rule.out}" more than once`);
        }
        produced.add(rule.out);
        const hasIn = rule.in !== undefined;
        const hasValue = rule.value !== undefined;
        if (hasIn === hasValue) {
          fail(`${where}: ${entry} projection for "${rule.out}" needs exactly one of "in" or "value"`);
        }
        if (hasIn && (typeof rule.in !== "string" || !DOT_PATH_RE.test(rule.in))) {
          fail(`${where}: ${entry} projection for "${rule.out}" has an invalid dot-path`);
        }
        if (rule.transform !== undefined && (typeof rule.transform !== "string" || !EMAIL_TRANSFORMS.has(rule.transform))) {
          fail(`${where}: ${entry} projection for "${rule.out}" has unknown transform "${String(rule.transform)}"`);
        }
        if (hasValue && rule.transform !== undefined) {
          fail(`${where}: ${entry} projection for "${rule.out}" cannot combine "value" with "transform"`);
        }
      }
      for (const required of REQUIRED_EMAIL_FIELDS) {
        if (!produced.has(required)) {
          fail(`${where}: ${entry} fieldProjection is missing required output "${required}"`);
        }
      }
    }

    const compose = src.compose;
    if (!isRecord(compose)) {
      fail(`${where}: ${entry} compose must be an object`);
    } else if (compose.mode === "createDraft") {
      // A createDraft source names a SECOND server (usually a write server, a
      // separate OAuth grant) — it must be owned by this plugin too, or a
      // manifest could point draft creation at a sibling plugin's connection.
      if (typeof compose.mcpServer !== "string" || !ownedServers.has(compose.mcpServer)) {
        fail(
          `${where}: ${entry} compose.mcpServer "${String(compose.mcpServer)}" is not declared by this plugin in .mcp.json`,
        );
      }
      if (typeof compose.newTool !== "string" || !compose.newTool) {
        fail(`${where}: ${entry} compose.newTool is required for mode "createDraft"`);
      }
      if (compose.replyTool !== undefined && typeof compose.replyTool !== "string") {
        fail(`${where}: ${entry} compose.replyTool must be a string when present`);
      }
      if (compose.resultUrlPath !== undefined && (typeof compose.resultUrlPath !== "string" || !DOT_PATH_RE.test(compose.resultUrlPath))) {
        fail(`${where}: ${entry} compose.resultUrlPath must be a dot-path`);
      }
      if (compose.urlTemplate !== undefined) {
        fail(`${where}: ${entry} compose.urlTemplate is not valid in mode "createDraft"`);
      }
    } else if (compose.mode !== "deeplink" || typeof compose.urlTemplate !== "string") {
      fail(`${where}: ${entry} compose.mode must be "deeplink" or "createDraft"`);
    } else {
      const template = compose.urlTemplate;
      if (!template.startsWith("https://")) {
        fail(`${where}: ${entry} compose.urlTemplate must be https://`);
      }
      if (/@/.test(template.split("?")[0] ?? "")) {
        fail(`${where}: ${entry} compose.urlTemplate must not embed credentials in its origin`);
      }
      for (const match of template.matchAll(/\{([a-zA-Z0-9_]+)\}/g)) {
        if (!COMPOSE_PLACEHOLDERS.has(match[1])) {
          fail(
            `${where}: ${entry} compose.urlTemplate uses unknown placeholder "{${match[1]}}" (allowed: ${[...COMPOSE_PLACEHOLDERS].join(", ")})`,
          );
        }
      }
    }
  }
}

function validatePlugin(pluginDirName: string, expectedName: string) {
  const pluginDir = join(repoRoot, "plugins", pluginDirName);
  if (!existsSync(pluginDir) || !statSync(pluginDir).isDirectory()) {
    fail(`plugin directory missing: plugins/${pluginDirName}`);
    return;
  }

  const manifestPath = join(pluginDir, ".claude-plugin", "plugin.json");
  const mcpPath = join(pluginDir, ".mcp.json");
  const readmePath = join(pluginDir, "README.md");

  for (const [label, p] of [
    ["plugin.json", manifestPath],
    [".mcp.json", mcpPath],
    ["README.md", readmePath],
  ] as const) {
    if (!existsSync(p)) fail(`plugins/${pluginDirName}: missing ${label}`);
  }
  if (errors.some((e) => e.includes(`plugins/${pluginDirName}: missing`))) return;

  const manifest = readJson<{
    name?: string;
    widgetElements?: string;
    widgets?: string;
    content?: unknown;
    briefingEmailSources?: unknown;
  }>(manifestPath);
  if (manifest && manifest.name && manifest.name !== expectedName) {
    fail(
      `plugins/${pluginDirName}: plugin.json name "${manifest.name}" does not match marketplace entry "${expectedName}"`,
    );
  }
  if (manifest) {
    validateWidgetElements(pluginDirName, manifest);
    if (manifest.content !== undefined) {
      validateContent(pluginDirName, manifest.content);
    }
  }

  const mcp = readJson<{
    mcpServers?: Record<
      string,
      {
        type?: string;
        url?: string;
        env?: Record<string, string>;
        headers?: Record<string, string>;
      }
    >;
  }>(mcpPath);
  if (!mcp || !mcp.mcpServers) {
    fail(`plugins/${pluginDirName}: .mcp.json has no mcpServers`);
    return;
  }

  // Briefing email sources are validated here, AFTER .mcp.json has parsed,
  // because the ownership rule needs the server list: a source may only name a
  // server its OWN plugin declares.
  if (manifest?.briefingEmailSources !== undefined) {
    validateBriefingEmailSources(
      pluginDirName,
      manifest.briefingEmailSources,
      new Set(Object.keys(mcp.mcpServers)),
    );
  }

  const readme = readFileSync(readmePath, "utf8");
  const documentedVars = extractConfigVars(readme);

  const ALLOWED_TRANSPORTS = new Set(["stdio", "sse", "http"]);

  for (const [serverName, server] of Object.entries(mcp.mcpServers)) {
    if (!server.type || !ALLOWED_TRANSPORTS.has(server.type)) {
      fail(
        `plugins/${pluginDirName}: mcp server "${serverName}" has type "${server.type}", must be one of ${[...ALLOWED_TRANSPORTS].join(", ")}`,
      );
    }
    // Env-agnostic-URL invariant: any myhub-hosted MCP URL must use the
    // PRODUCTION FQDN on every branch. Per-environment routing is handled at
    // runtime by myHub's MCP_SERVERS_BASE_URL host-rewrite — branches must NOT
    // bake in staging/dev hosts. (Third-party hosts like mcp.monday.com are
    // unaffected; stdio servers have no URL.)
    if (typeof server.url === "string" && server.url.length > 0) {
      let host = "";
      try {
        host = new URL(server.url).host;
      } catch {
        fail(`plugins/${pluginDirName}: mcp server "${serverName}" has an invalid url "${server.url}"`);
      }
      if (host && /(^|\.)myhub-mcp-servers/.test(host) && host !== PROD_MCP_HOST) {
        fail(
          `plugins/${pluginDirName}: mcp server "${serverName}" points at "${host}" — myhub MCP URLs must use the production host "${PROD_MCP_HOST}" on every branch (per-env routing is handled by MCP_SERVERS_BASE_URL at runtime)`,
        );
      }
    }
    // Check placeholders in both env (stdio) and headers (sse/http) for
    // credentials that must be documented.
    const placeholderSources: Record<string, string> = {
      ...(server.env ?? {}),
      ...(server.headers ?? {}),
    };
    for (const [key, raw] of Object.entries(placeholderSources)) {
      if (typeof raw !== "string") continue;
      for (const placeholder of extractPlaceholders(raw)) {
        if (RESERVED_VARS.has(placeholder)) continue;
        if (!documentedVars.has(placeholder)) {
          fail(
            `plugins/${pluginDirName}: ${key} uses \${${placeholder}} but it is not documented under a "Configuration" heading in README.md`,
          );
        }
      }
    }
  }
}

function main() {
  const marketplacePath = join(repoRoot, ".claude-plugin", "marketplace.json");
  if (!existsSync(marketplacePath)) {
    fail("missing .claude-plugin/marketplace.json");
    report();
    return;
  }
  const marketplace = readJson<Marketplace>(marketplacePath);
  if (!marketplace) {
    report();
    return;
  }

  if (!Array.isArray(marketplace.plugins) || marketplace.plugins.length === 0) {
    fail("marketplace.json: plugins array is empty");
  }

  for (const p of marketplace.plugins ?? []) {
    if (!p.name) {
      fail("marketplace.json: a plugin entry is missing name");
      continue;
    }
    const sourcePath = resolveSourcePath(p.source);
    if (!sourcePath) {
      fail(
        `marketplace.json: plugin "${p.name}" has an unrecognised source - use "./plugins/<name>" shorthand`,
      );
      continue;
    }
    const relPath = sourcePath.replace(/^\.\//, "").replace(/^plugins\//, "");
    validatePlugin(relPath, p.name);
  }

  report();
}

function report() {
  if (errors.length === 0) {
    console.log("validate: OK");
    return;
  }
  console.error("validate: FAILED");
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}

main();
