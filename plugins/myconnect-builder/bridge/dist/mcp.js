/**
 * Typed wrapper over the workspace's external MCP endpoint. The bridge is an
 * MCP *client*; the workspace is the server (16+3 workq_* tools, OAuth
 * scope-gated). Every call authenticates as the myConnect Builder
 * service-account user — the item-visibility and scope checks are all
 * server-side.
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js';
import { waitForCallback } from './oauth.js';
export class WorkspaceClient {
    mcpUrl;
    authProvider;
    callbackPort;
    client = null;
    constructor(mcpUrl, authProvider, callbackPort) {
        this.mcpUrl = mcpUrl;
        this.authProvider = authProvider;
        this.callbackPort = callbackPort;
    }
    async connect() {
        const attempt = async () => {
            const client = new Client({ name: 'mcb-bridge', version: '0.1.0' });
            const transport = new StreamableHTTPClientTransport(new URL(this.mcpUrl), {
                authProvider: this.authProvider,
            });
            try {
                await client.connect(transport);
                return client;
            }
            catch (err) {
                if (err instanceof UnauthorizedError) {
                    // First run (or revoked token): the provider has opened the browser;
                    // catch the redirect, finish the code exchange, then reconnect.
                    const code = await waitForCallback(this.callbackPort);
                    await transport.finishAuth(code);
                    const retryClient = new Client({ name: 'mcb-bridge', version: '0.1.0' });
                    await retryClient.connect(new StreamableHTTPClientTransport(new URL(this.mcpUrl), {
                        authProvider: this.authProvider,
                    }));
                    return retryClient;
                }
                throw err;
            }
        };
        this.client = await attempt();
    }
    async close() {
        await this.client?.close().catch(() => { });
        this.client = null;
    }
    async call(name, args) {
        if (!this.client)
            throw new Error('WorkspaceClient not connected');
        const res = await this.client.callTool({ name, arguments: args });
        const content = (res.content ?? []);
        const text = content.map((c) => c.text ?? '').join('');
        if (res.isError)
            throw new Error(`${name} failed: ${text}`);
        try {
            return JSON.parse(text);
        }
        catch {
            throw new Error(`${name} returned non-JSON payload: ${text.slice(0, 200)}`);
        }
    }
    /** Open items assigned to the builder account (server filters visibility). */
    async listAssigned(builderUserId) {
        const items = await this.call('workq_list', { assignedTo: builderUserId });
        return items.filter((t) => t.status === 'not_started' || t.status === 'in_progress');
    }
    getItem(todoId) {
        return this.call('workq_get', { todoId });
    }
    async listComments(todoId, limit = 50) {
        const page = await this.call('workq_list_comments', {
            todoId,
            limit: Math.min(limit, 100),
        });
        return page.comments;
    }
    async addComment(todoId, body, mentions = []) {
        await this.call('workq_add_comment', { todoId, body, mentions });
    }
    async setLabels(todoId, labels) {
        await this.call('workq_update', { todoId, labels });
    }
    async setStatus(todoId, status) {
        await this.call('workq_set_status', { todoId, status });
    }
    async listAttachments(todoId) {
        const res = await this.call('workq_list_attachments', {
            todoId,
        });
        return res.attachments;
    }
    async downloadAttachment(todoId, attachmentId) {
        const meta = await this.call('workq_get_attachment', {
            todoId,
            attachmentId,
        });
        const url = meta.downloadUrl.startsWith('/')
            ? new URL(meta.downloadUrl, new URL(this.mcpUrl).origin).toString()
            : meta.downloadUrl;
        const res = await fetch(url);
        if (!res.ok)
            throw new Error(`Attachment download failed (${res.status}) for ${meta.fileName}`);
        return { fileName: meta.fileName, bytes: Buffer.from(await res.arrayBuffer()) };
    }
    async uploadAttachment(todoId, fileName, contentType, bytes) {
        await this.call('workq_upload_attachment', {
            todoId,
            fileName,
            contentType,
            contentBase64: bytes.toString('base64'),
        });
    }
}
