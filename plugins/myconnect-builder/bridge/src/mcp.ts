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
import { FileAuthProvider, waitForCallback } from './oauth.js';

export interface WorkqItem {
  id: string;
  title: string;
  description: string | null;
  status: 'not_started' | 'in_progress' | 'done' | 'cancelled';
  labels: string[];
  assigneeIds: string[];
  createdBy: string;
  updatedAt?: string;
}

export interface WorkqComment {
  id: string;
  todoId: string;
  authorId: string;
  authorName?: string;
  body: string;
  createdAt: string;
}

export interface WorkqAttachment {
  id: string;
  todoId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  kind: string;
  uploadedBy: string;
  createdAt: string;
}

export class WorkspaceClient {
  private client: Client | null = null;

  constructor(
    private readonly mcpUrl: string,
    private readonly authProvider: FileAuthProvider,
    private readonly callbackPort: number,
  ) {}

  async connect(): Promise<void> {
    const attempt = async (): Promise<Client> => {
      const client = new Client({ name: 'mcb-bridge', version: '0.1.0' });
      const transport = new StreamableHTTPClientTransport(new URL(this.mcpUrl), {
        authProvider: this.authProvider,
      });
      try {
        await client.connect(transport);
        return client;
      } catch (err) {
        if (err instanceof UnauthorizedError) {
          // First run (or revoked token): the provider has opened the browser;
          // catch the redirect, finish the code exchange, then reconnect.
          const code = await waitForCallback(this.callbackPort);
          await transport.finishAuth(code);
          const retryClient = new Client({ name: 'mcb-bridge', version: '0.1.0' });
          await retryClient.connect(
            new StreamableHTTPClientTransport(new URL(this.mcpUrl), {
              authProvider: this.authProvider,
            }),
          );
          return retryClient;
        }
        throw err;
      }
    };
    this.client = await attempt();
  }

  async close(): Promise<void> {
    await this.client?.close().catch(() => {});
    this.client = null;
  }

  private async call<T>(name: string, args: Record<string, unknown>): Promise<T> {
    if (!this.client) throw new Error('WorkspaceClient not connected');
    const res = await this.client.callTool({ name, arguments: args });
    const content = (res.content ?? []) as Array<{ type: string; text?: string }>;
    const text = content.map((c) => c.text ?? '').join('');
    if (res.isError) throw new Error(`${name} failed: ${text}`);
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error(`${name} returned non-JSON payload: ${text.slice(0, 200)}`);
    }
  }

  /** Open items assigned to the builder account (server filters visibility). */
  async listAssigned(builderUserId: string): Promise<WorkqItem[]> {
    const items = await this.call<WorkqItem[]>('workq_list', { assignedTo: builderUserId });
    return items.filter((t) => t.status === 'not_started' || t.status === 'in_progress');
  }

  getItem(todoId: string): Promise<WorkqItem> {
    return this.call<WorkqItem>('workq_get', { todoId });
  }

  async listComments(todoId: string, limit = 50): Promise<WorkqComment[]> {
    const page = await this.call<{ comments: WorkqComment[] }>('workq_list_comments', {
      todoId,
      limit: Math.min(limit, 100),
    });
    return page.comments;
  }

  async addComment(todoId: string, body: string, mentions: string[] = []): Promise<void> {
    await this.call('workq_add_comment', { todoId, body, mentions });
  }

  async setLabels(todoId: string, labels: string[]): Promise<void> {
    await this.call('workq_update', { todoId, labels });
  }

  async setStatus(todoId: string, status: WorkqItem['status']): Promise<void> {
    await this.call('workq_set_status', { todoId, status });
  }

  async listAttachments(todoId: string): Promise<WorkqAttachment[]> {
    const res = await this.call<{ attachments: WorkqAttachment[] }>('workq_list_attachments', {
      todoId,
    });
    return res.attachments;
  }

  async downloadAttachment(todoId: string, attachmentId: string): Promise<{ fileName: string; bytes: Buffer }> {
    const meta = await this.call<{ downloadUrl: string; fileName: string }>('workq_get_attachment', {
      todoId,
      attachmentId,
    });
    const url = meta.downloadUrl.startsWith('/')
      ? new URL(meta.downloadUrl, new URL(this.mcpUrl).origin).toString()
      : meta.downloadUrl;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Attachment download failed (${res.status}) for ${meta.fileName}`);
    return { fileName: meta.fileName, bytes: Buffer.from(await res.arrayBuffer()) };
  }

  async uploadAttachment(
    todoId: string,
    fileName: string,
    contentType: string,
    bytes: Buffer,
  ): Promise<void> {
    await this.call('workq_upload_attachment', {
      todoId,
      fileName,
      contentType,
      contentBase64: bytes.toString('base64'),
    });
  }
}
