#!/usr/bin/env node
/**
 * deskcrm MCP server
 *
 * A stdio Model Context Protocol server that exposes CRUD tools over an
 * Excel workbook containing two sheets: Contacts and Accounts.
 *
 * Protocol: newline-delimited JSON-RPC 2.0 on stdin/stdout, per the MCP
 * stdio transport spec. We implement the handful of methods the MCP host
 * actually calls (initialize, tools/list, tools/call) directly rather than
 * pulling in the @modelcontextprotocol/sdk package, to keep the bundled
 * dist/ tiny.
 *
 * Configuration:
 *   DESKCRM_WORKBOOK_PATH  Absolute path to the workbook. Optional.
 *                         Defaults to ${CLAUDE_PLUGIN_ROOT}/data/deskcrm.xlsx.
 *   CLAUDE_PLUGIN_ROOT    Set by the MCP host to the plugin install dir.
 */

const { existsSync } = require("node:fs");
const { join } = require("node:path");
const { randomUUID } = require("node:crypto");
const XLSX = require("xlsx");

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_NAME = "deskcrm";
const SERVER_VERSION = "0.1.0";

const CONTACTS_SHEET = "Contacts";
const ACCOUNTS_SHEET = "Accounts";

// ──────────────────────────────────────────────────────────────────────────
// Workbook resolution
// ──────────────────────────────────────────────────────────────────────────

function resolveWorkbookPath() {
  const explicit = process.env.DESKCRM_WORKBOOK_PATH;
  if (explicit && explicit.trim().length > 0) return explicit;
  const root = process.env.CLAUDE_PLUGIN_ROOT;
  if (root && root.trim().length > 0) {
    return join(root, "data", "deskcrm.xlsx");
  }
  return null;
}

const WORKBOOK_PATH = resolveWorkbookPath();

if (!WORKBOOK_PATH) {
  console.error(
    "[deskcrm] No workbook path. Set DESKCRM_WORKBOOK_PATH or CLAUDE_PLUGIN_ROOT.",
  );
  process.exit(1);
}
if (!existsSync(WORKBOOK_PATH)) {
  console.error(`[deskcrm] Workbook not found at ${WORKBOOK_PATH}`);
  process.exit(1);
}

// ──────────────────────────────────────────────────────────────────────────
// Workbook I/O
// ──────────────────────────────────────────────────────────────────────────

function loadWorkbook() {
  return XLSX.readFile(WORKBOOK_PATH);
}

function readRows(wb, sheetName) {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { defval: "" });
}

function writeRows(wb, sheetName, rows) {
  wb.Sheets[sheetName] = XLSX.utils.json_to_sheet(rows);
  if (!wb.SheetNames.includes(sheetName)) wb.SheetNames.push(sheetName);
  XLSX.writeFile(wb, WORKBOOK_PATH);
}

function nowIso() {
  return new Date().toISOString();
}

function newId(prefix) {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

function stringIncludes(haystack, needle) {
  return String(haystack ?? "")
    .toLowerCase()
    .includes(String(needle ?? "").toLowerCase());
}

// ──────────────────────────────────────────────────────────────────────────
// Contact operations
// ──────────────────────────────────────────────────────────────────────────

const CONTACT_FIELDS = [
  "id",
  "firstName",
  "lastName",
  "email",
  "phone",
  "company",
  "title",
  "status",
  "tags",
  "notes",
  "createdAt",
  "updatedAt",
];

function listContacts(args = {}) {
  const wb = loadWorkbook();
  const rows = readRows(wb, CONTACTS_SHEET);
  let out = rows;
  if (args.status) out = out.filter((r) => r.status === args.status);
  if (args.company) out = out.filter((r) => stringIncludes(r.company, args.company));
  if (args.query) {
    const q = String(args.query).toLowerCase();
    out = out.filter((r) =>
      [r.firstName, r.lastName, r.email, r.company, r.title, r.notes, r.tags]
        .some((v) => String(v ?? "").toLowerCase().includes(q)),
    );
  }
  const limit = Number.isFinite(args.limit) ? args.limit : 100;
  return { count: out.length, contacts: out.slice(0, limit) };
}

function getContact(args) {
  if (!args || !args.id) throw new Error("id is required");
  const wb = loadWorkbook();
  const rows = readRows(wb, CONTACTS_SHEET);
  const row = rows.find((r) => r.id === args.id);
  if (!row) throw new Error(`Contact not found: ${args.id}`);
  return row;
}

function createContact(args = {}) {
  if (!args.firstName || !args.lastName) {
    throw new Error("firstName and lastName are required");
  }
  const wb = loadWorkbook();
  const rows = readRows(wb, CONTACTS_SHEET);
  const ts = nowIso();
  const contact = {
    id: newId("cnt"),
    firstName: args.firstName,
    lastName: args.lastName,
    email: args.email || "",
    phone: args.phone || "",
    company: args.company || "",
    title: args.title || "",
    status: args.status || "active",
    tags: Array.isArray(args.tags) ? args.tags.join(",") : args.tags || "",
    notes: args.notes || "",
    createdAt: ts,
    updatedAt: ts,
  };
  rows.push(contact);
  writeRows(wb, CONTACTS_SHEET, rows);
  return contact;
}

function updateContact(args = {}) {
  if (!args.id) throw new Error("id is required");
  const wb = loadWorkbook();
  const rows = readRows(wb, CONTACTS_SHEET);
  const idx = rows.findIndex((r) => r.id === args.id);
  if (idx === -1) throw new Error(`Contact not found: ${args.id}`);
  const patch = { ...args.patch };
  for (const key of Object.keys(patch)) {
    if (!CONTACT_FIELDS.includes(key) || key === "id" || key === "createdAt") {
      delete patch[key];
    }
  }
  if (Array.isArray(patch.tags)) patch.tags = patch.tags.join(",");
  rows[idx] = { ...rows[idx], ...patch, updatedAt: nowIso() };
  writeRows(wb, CONTACTS_SHEET, rows);
  return rows[idx];
}

function deleteContact(args = {}) {
  if (!args.id) throw new Error("id is required");
  const wb = loadWorkbook();
  const rows = readRows(wb, CONTACTS_SHEET);
  const idx = rows.findIndex((r) => r.id === args.id);
  if (idx === -1) throw new Error(`Contact not found: ${args.id}`);
  const [removed] = rows.splice(idx, 1);
  writeRows(wb, CONTACTS_SHEET, rows);
  return { deleted: true, contact: removed };
}

// ──────────────────────────────────────────────────────────────────────────
// Account operations
// ──────────────────────────────────────────────────────────────────────────

const ACCOUNT_FIELDS = [
  "id",
  "name",
  "industry",
  "employees",
  "website",
  "phone",
  "billingCity",
  "billingCountry",
  "owner",
  "stage",
  "arr",
  "renewalDate",
  "notes",
  "createdAt",
  "updatedAt",
];

function listAccounts(args = {}) {
  const wb = loadWorkbook();
  const rows = readRows(wb, ACCOUNTS_SHEET);
  let out = rows;
  if (args.stage) out = out.filter((r) => r.stage === args.stage);
  if (args.industry) out = out.filter((r) => stringIncludes(r.industry, args.industry));
  if (args.owner) out = out.filter((r) => stringIncludes(r.owner, args.owner));
  if (args.query) {
    const q = String(args.query).toLowerCase();
    out = out.filter((r) =>
      [r.name, r.industry, r.website, r.billingCity, r.owner, r.notes]
        .some((v) => String(v ?? "").toLowerCase().includes(q)),
    );
  }
  const limit = Number.isFinite(args.limit) ? args.limit : 100;
  return { count: out.length, accounts: out.slice(0, limit) };
}

function getAccount(args) {
  if (!args || !args.id) throw new Error("id is required");
  const wb = loadWorkbook();
  const rows = readRows(wb, ACCOUNTS_SHEET);
  const row = rows.find((r) => r.id === args.id);
  if (!row) throw new Error(`Account not found: ${args.id}`);
  return row;
}

function createAccount(args = {}) {
  if (!args.name) throw new Error("name is required");
  const wb = loadWorkbook();
  const rows = readRows(wb, ACCOUNTS_SHEET);
  const ts = nowIso();
  const account = {
    id: newId("acc"),
    name: args.name,
    industry: args.industry || "",
    employees: args.employees ?? "",
    website: args.website || "",
    phone: args.phone || "",
    billingCity: args.billingCity || "",
    billingCountry: args.billingCountry || "",
    owner: args.owner || "",
    stage: args.stage || "prospect",
    arr: args.arr ?? 0,
    renewalDate: args.renewalDate || "",
    notes: args.notes || "",
    createdAt: ts,
    updatedAt: ts,
  };
  rows.push(account);
  writeRows(wb, ACCOUNTS_SHEET, rows);
  return account;
}

function updateAccount(args = {}) {
  if (!args.id) throw new Error("id is required");
  const wb = loadWorkbook();
  const rows = readRows(wb, ACCOUNTS_SHEET);
  const idx = rows.findIndex((r) => r.id === args.id);
  if (idx === -1) throw new Error(`Account not found: ${args.id}`);
  const patch = { ...args.patch };
  for (const key of Object.keys(patch)) {
    if (!ACCOUNT_FIELDS.includes(key) || key === "id" || key === "createdAt") {
      delete patch[key];
    }
  }
  rows[idx] = { ...rows[idx], ...patch, updatedAt: nowIso() };
  writeRows(wb, ACCOUNTS_SHEET, rows);
  return rows[idx];
}

function deleteAccount(args = {}) {
  if (!args.id) throw new Error("id is required");
  const wb = loadWorkbook();
  const rows = readRows(wb, ACCOUNTS_SHEET);
  const idx = rows.findIndex((r) => r.id === args.id);
  if (idx === -1) throw new Error(`Account not found: ${args.id}`);
  const [removed] = rows.splice(idx, 1);
  writeRows(wb, ACCOUNTS_SHEET, rows);
  return { deleted: true, account: removed };
}

// ──────────────────────────────────────────────────────────────────────────
// Tool registry
// ──────────────────────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "list_contacts",
    description:
      "List contacts from the Contacts sheet. Supports filtering by status, company substring, and a free-text query across name, email, company, title, notes, and tags. Returns a count and up to `limit` rows (default 100).",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", description: "Exact status filter, e.g. active, lead, churned." },
        company: { type: "string", description: "Case-insensitive substring match on company." },
        query: { type: "string", description: "Free-text search across key fields." },
        limit: { type: "number", description: "Maximum rows to return (default 100)." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_contact",
    description: "Fetch a single contact by id.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Contact id (cnt_...)." } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "create_contact",
    description:
      "Create a new contact. firstName and lastName are required. Assigns a new id and createdAt/updatedAt timestamps.",
    inputSchema: {
      type: "object",
      properties: {
        firstName: { type: "string" },
        lastName: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        company: { type: "string" },
        title: { type: "string" },
        status: { type: "string", description: "One of: active, lead, churned, archived." },
        tags: {
          oneOf: [
            { type: "string", description: "Comma-separated tag list." },
            { type: "array", items: { type: "string" } },
          ],
        },
        notes: { type: "string" },
      },
      required: ["firstName", "lastName"],
      additionalProperties: false,
    },
  },
  {
    name: "update_contact",
    description:
      "Patch an existing contact. Only whitelisted fields are applied; id and createdAt cannot be changed.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        patch: {
          type: "object",
          description: "Partial contact fields to update.",
          additionalProperties: true,
        },
      },
      required: ["id", "patch"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_contact",
    description: "Delete a contact by id. Returns the removed row.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "list_accounts",
    description:
      "List accounts from the Accounts sheet. Filters: stage (exact), industry (substring), owner (substring), query (free-text). Returns count + rows up to `limit` (default 100).",
    inputSchema: {
      type: "object",
      properties: {
        stage: { type: "string", description: "prospect, qualified, customer, churned." },
        industry: { type: "string" },
        owner: { type: "string" },
        query: { type: "string" },
        limit: { type: "number" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_account",
    description: "Fetch a single account by id.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "Account id (acc_...)." } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "create_account",
    description: "Create a new account. Only name is required; other fields default to empty/zero.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        industry: { type: "string" },
        employees: { type: "number" },
        website: { type: "string" },
        phone: { type: "string" },
        billingCity: { type: "string" },
        billingCountry: { type: "string" },
        owner: { type: "string" },
        stage: { type: "string", description: "prospect, qualified, customer, churned." },
        arr: { type: "number", description: "Annual recurring revenue in USD." },
        renewalDate: { type: "string", description: "ISO date (YYYY-MM-DD)." },
        notes: { type: "string" },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "update_account",
    description:
      "Patch an existing account. Only whitelisted fields are applied; id and createdAt are immutable.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        patch: { type: "object", additionalProperties: true },
      },
      required: ["id", "patch"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_account",
    description: "Delete an account by id. Returns the removed row.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
      additionalProperties: false,
    },
  },
];

const DISPATCH = {
  list_contacts: listContacts,
  get_contact: getContact,
  create_contact: createContact,
  update_contact: updateContact,
  delete_contact: deleteContact,
  list_accounts: listAccounts,
  get_account: getAccount,
  create_account: createAccount,
  update_account: updateAccount,
  delete_account: deleteAccount,
};

// ──────────────────────────────────────────────────────────────────────────
// JSON-RPC 2.0 loop (MCP stdio transport)
// ──────────────────────────────────────────────────────────────────────────

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

function sendError(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

function handleMessage(msg) {
  if (msg.jsonrpc !== "2.0") return;

  if (msg.method === "initialize") {
    send({
      jsonrpc: "2.0",
      id: msg.id,
      result: {
        protocolVersion: PROTOCOL_VERSION,
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
        capabilities: { tools: {} },
      },
    });
    return;
  }

  if (msg.method === "notifications/initialized" || msg.method === "initialized") {
    return;
  }

  if (msg.method === "ping") {
    send({ jsonrpc: "2.0", id: msg.id, result: {} });
    return;
  }

  if (msg.method === "tools/list") {
    send({ jsonrpc: "2.0", id: msg.id, result: { tools: TOOLS } });
    return;
  }

  if (msg.method === "tools/call") {
    const params = msg.params || {};
    const handler = DISPATCH[params.name];
    if (!handler) {
      sendError(msg.id, -32601, `Unknown tool: ${params.name}`);
      return;
    }
    try {
      const result = handler(params.arguments || {});
      send({
        jsonrpc: "2.0",
        id: msg.id,
        result: {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
          isError: false,
        },
      });
    } catch (err) {
      send({
        jsonrpc: "2.0",
        id: msg.id,
        result: {
          content: [
            { type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` },
          ],
          isError: true,
        },
      });
    }
    return;
  }

  if (msg.method === "resources/list") {
    send({ jsonrpc: "2.0", id: msg.id, result: { resources: [] } });
    return;
  }

  if (msg.method === "prompts/list") {
    send({ jsonrpc: "2.0", id: msg.id, result: { prompts: [] } });
    return;
  }

  if (msg.id !== undefined) {
    sendError(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let idx;
  while ((idx = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    try {
      handleMessage(msg);
    } catch (err) {
      console.error("[deskcrm] handler error:", err);
    }
  }
});

process.stdin.on("end", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

console.error(`[deskcrm] ready (workbook: ${WORKBOOK_PATH})`);
