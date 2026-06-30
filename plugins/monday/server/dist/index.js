#!/usr/bin/env node
// Mock monday.com MCP stdio server (in-memory)
// Exposes a small set of tools: list_boards, get_board, list_items, create_item, create_update, list_users

const PROTOCOL_VERSION = "2024-11-05";
const SERVER_NAME = "monday-mock";
const SERVER_VERSION = "0.1.0";

const { randomUUID } = require('node:crypto');

const BOARDS = [
  { id: 'b1', name: 'Marketing Board', description: 'Marketing tasks' },
  { id: 'b2', name: 'Engineering Board', description: 'Engineering tasks' },
];

const ITEMS = {
  b1: [
    { id: 'i1', name: 'Launch campaign', column_values: { status: 'todo' } },
    { id: 'i2', name: 'Write blog post', column_values: { status: 'in_progress' } },
  ],
  b2: [
    { id: 'i3', name: 'Implement auth', column_values: { status: 'in_review' } },
  ],
};

const UPDATES = {
  i1: [ { id: 'u1', text: 'Initial brief', createdAt: new Date().toISOString() } ],
};

const USERS = [
  { id: 'u_ana', name: 'Ana', email: 'ana@example.com' },
  { id: 'u_bob', name: 'Bob', email: 'bob@example.com' },
];

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

function sendError(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

function nowIso() { return new Date().toISOString(); }

// Tool implementations
function listBoards() {
  return { count: BOARDS.length, boards: BOARDS };
}

function getBoard(args = {}) {
  if (!args.id) throw new Error('id is required');
  const b = BOARDS.find(x => x.id === args.id);
  if (!b) throw new Error(`Board not found: ${args.id}`);
  const items = ITEMS[args.id] || [];
  return { board: b, itemsCount: items.length };
}

function listItems(args = {}) {
  if (!args.boardId) throw new Error('boardId is required');
  const items = ITEMS[args.boardId] || [];
  const limit = Number.isFinite(args.limit) ? args.limit : 100;
  return { count: items.length, items: items.slice(0, limit) };
}

function createItem(args = {}) {
  if (!args.boardId || !args.name) throw new Error('boardId and name are required');
  const id = 'i_' + randomUUID().slice(0,8);
  const item = { id, name: args.name, column_values: args.column_values || {} };
  if (!ITEMS[args.boardId]) ITEMS[args.boardId] = [];
  ITEMS[args.boardId].push(item);
  return item;
}

function createUpdate(args = {}) {
  if (!args.itemId || !args.text) throw new Error('itemId and text are required');
  const id = 'u_' + randomUUID().slice(0,8);
  const upd = { id, text: args.text, createdAt: nowIso() };
  if (!UPDATES[args.itemId]) UPDATES[args.itemId] = [];
  UPDATES[args.itemId].push(upd);
  return upd;
}

function listUsers() {
  return { count: USERS.length, users: USERS };
}

const TOOLS = [
  { name: 'list_boards', description: 'List available boards.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'get_board', description: 'Get board metadata and item count.', inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false } },
  { name: 'list_items', description: 'List items on a board.', inputSchema: { type: 'object', properties: { boardId: { type: 'string' }, limit: { type: 'number' } }, required: ['boardId'], additionalProperties: false } },
  { name: 'create_item', description: 'Create an item on a board.', inputSchema: { type: 'object', properties: { boardId: { type: 'string' }, name: { type: 'string' }, column_values: { type: 'object' } }, required: ['boardId','name'], additionalProperties: false } },
  { name: 'create_update', description: 'Post an update on an item.', inputSchema: { type: 'object', properties: { itemId: { type: 'string' }, text: { type: 'string' } }, required: ['itemId','text'], additionalProperties: false } },
  { name: 'list_users', description: 'List mock users.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
];

const DISPATCH = {
  list_boards: listBoards,
  get_board: getBoard,
  list_items: listItems,
  create_item: createItem,
  create_update: createUpdate,
  list_users: listUsers,
};

// MCP stdio JSON-RPC loop
function handleMessage(msg) {
  if (msg.jsonrpc !== '2.0') return;
  if (msg.method === 'initialize') {
    send({ jsonrpc: '2.0', id: msg.id, result: { protocolVersion: PROTOCOL_VERSION, serverInfo: { name: SERVER_NAME, version: SERVER_VERSION }, capabilities: { tools: {} } } });
    return;
  }
  if (msg.method === 'notifications/initialized' || msg.method === 'initialized') return;
  if (msg.method === 'ping') { send({ jsonrpc: '2.0', id: msg.id, result: {} }); return; }
  if (msg.method === 'tools/list') { send({ jsonrpc: '2.0', id: msg.id, result: { tools: TOOLS } }); return; }
  if (msg.method === 'tools/call') {
    const params = msg.params || {};
    const handler = DISPATCH[params.name];
    if (!handler) { sendError(msg.id, -32601, `Unknown tool: ${params.name}`); return; }
    try {
      const result = handler(params.arguments || {});
      send({ jsonrpc: '2.0', id: msg.id, result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }], isError: false } });
    } catch (err) {
      send({ jsonrpc: '2.0', id: msg.id, result: { content: [{ type: 'text', text: `Error: ${err instanceof Error ? err.message : String(err)}` }], isError: true } });
    }
    return;
  }
  if (msg.method === 'resources/list') { send({ jsonrpc: '2.0', id: msg.id, result: { resources: [] } }); return; }
  if (msg.method === 'prompts/list') { send({ jsonrpc: '2.0', id: msg.id, result: { prompts: [] } }); return; }
  if (msg.id !== undefined) sendError(msg.id, -32601, `Method not found: ${msg.method}`);
}

let buffer = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let idx;
  while ((idx = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    try { handleMessage(msg); } catch (err) { console.error('[monday-mock] handler error:', err); }
  }
});

process.stdin.on('end', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

console.error(`[monday-mock] ready`);
