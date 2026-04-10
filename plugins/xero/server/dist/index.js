#!/usr/bin/env node
/**
 * mySMB Xero MCP server.
 *
 * stdio transport. All credentials come from process.env. Exits 1 on
 * startup if any required variable is missing.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { XeroTokenProvider } from "./auth.js";
import { XeroApiClient } from "./client.js";
import { listInvoices, listInvoicesInput } from "./tools/list-invoices.js";
import { getContact, getContactInput } from "./tools/get-contact.js";
import { createInvoice, createInvoiceInput } from "./tools/create-invoice.js";
import { getProfitAndLoss, getProfitAndLossInput, } from "./tools/get-profit-and-loss.js";
const REQUIRED_ENV = [
    "XERO_CLIENT_ID",
    "XERO_CLIENT_SECRET",
    "XERO_REDIRECT_URI",
    "XERO_TENANT_ID",
];
function loadEnvOrExit() {
    const missing = [];
    const out = {};
    for (const key of REQUIRED_ENV) {
        const v = process.env[key];
        if (!v || v.trim() === "") {
            missing.push(key);
        }
        else {
            out[key] = v;
        }
    }
    if (missing.length > 0) {
        process.stderr.write(`xero-mcp: missing required environment variable(s): ${missing.join(", ")}\n` +
            `xero-mcp: this plugin never prompts interactively - set the variables and restart.\n`);
        process.exit(1);
    }
    return out;
}
function def(name, description, schema, handler) {
    return { name, description, schema, handler };
}
async function main() {
    const env = loadEnvOrExit();
    const tokens = new XeroTokenProvider({
        clientId: env.XERO_CLIENT_ID,
        clientSecret: env.XERO_CLIENT_SECRET,
        tenantId: env.XERO_TENANT_ID,
    });
    const client = new XeroApiClient(tokens);
    const tools = [
        def("list_invoices", "List recent invoices for the connected Xero tenant. Optional status filter and limit.", listInvoicesInput, listInvoices),
        def("get_contact", "Fetch a single Xero contact by id.", getContactInput, getContact),
        def("create_invoice", "Create a draft invoice in Xero for the given contact and line items.", createInvoiceInput, createInvoice),
        def("get_profit_and_loss", "Fetch the Xero Profit and Loss report for a date range.", getProfitAndLossInput, getProfitAndLoss),
    ];
    const toolsByName = new Map(tools.map((t) => [t.name, t]));
    const server = new Server({ name: "xero", version: "0.1.0" }, { capabilities: { tools: {} } });
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: tools.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: zodToJsonSchema(t.schema),
        })),
    }));
    server.setRequestHandler(CallToolRequestSchema, async (req) => {
        const tool = toolsByName.get(req.params.name);
        if (!tool) {
            throw new Error(`unknown tool: ${req.params.name}`);
        }
        const parsed = tool.schema.safeParse(req.params.arguments ?? {});
        if (!parsed.success) {
            return {
                isError: true,
                content: [
                    {
                        type: "text",
                        text: `invalid arguments for ${tool.name}: ${parsed.error.message}`,
                    },
                ],
            };
        }
        try {
            const result = await tool.handler(client, parsed.data);
            return {
                content: [{ type: "text", text: JSON.stringify(result) }],
            };
        }
        catch (err) {
            return {
                isError: true,
                content: [
                    {
                        type: "text",
                        text: `${tool.name} failed: ${err.message}`,
                    },
                ],
            };
        }
    });
    const transport = new StdioServerTransport();
    await server.connect(transport);
    process.stderr.write("xero-mcp: ready\n");
}
/**
 * Minimal zod -> JSON Schema converter covering only the shapes we use in
 * this plugin's tool inputs. Avoids pulling in zod-to-json-schema as a
 * dependency.
 */
function zodToJsonSchema(schema) {
    const def = schema._def;
    switch (def.typeName) {
        case "ZodObject": {
            const shape = def.shape();
            const properties = {};
            const required = [];
            for (const [key, value] of Object.entries(shape)) {
                properties[key] = zodToJsonSchema(value);
                if (!value.isOptional?.())
                    required.push(key);
            }
            const out = {
                type: "object",
                properties,
            };
            if (required.length > 0)
                out.required = required;
            return out;
        }
        case "ZodString": {
            const out = { type: "string" };
            if (def.description)
                out.description = def.description;
            return out;
        }
        case "ZodNumber": {
            const out = { type: "number" };
            if (def.description)
                out.description = def.description;
            return out;
        }
        case "ZodBoolean":
            return { type: "boolean" };
        case "ZodEnum":
            return { type: "string", enum: def.values };
        case "ZodArray":
            return { type: "array", items: zodToJsonSchema(def.type) };
        case "ZodOptional":
            return zodToJsonSchema(def.innerType);
        case "ZodDefault":
            return zodToJsonSchema(def.innerType);
        default:
            return {};
    }
}
main().catch((err) => {
    process.stderr.write(`xero-mcp: fatal: ${err.stack ?? err}\n`);
    process.exit(1);
});
