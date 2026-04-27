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
 *
 * Exits 1 on any failure.
 */
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const errors: string[] = [];
const fail = (msg: string) => errors.push(msg);

const RESERVED_VARS = new Set(["CLAUDE_PLUGIN_ROOT"]);

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
  }>(manifestPath);
  if (manifest && manifest.name && manifest.name !== expectedName) {
    fail(
      `plugins/${pluginDirName}: plugin.json name "${manifest.name}" does not match marketplace entry "${expectedName}"`,
    );
  }
  if (manifest) {
    validateWidgetElements(pluginDirName, manifest);
  }

  const mcp = readJson<{
    mcpServers?: Record<
      string,
      { type?: string; env?: Record<string, string>; headers?: Record<string, string> }
    >;
  }>(mcpPath);
  if (!mcp || !mcp.mcpServers) {
    fail(`plugins/${pluginDirName}: .mcp.json has no mcpServers`);
    return;
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
