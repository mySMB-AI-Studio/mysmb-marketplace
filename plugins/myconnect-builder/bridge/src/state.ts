import { readFileSync, writeFileSync, existsSync } from 'node:fs';

/**
 * Local per-item state. WorkQ (labels + comments) is the durable source of
 * truth for pipeline STAGE — this file only carries what the workspace
 * cannot: the Claude session id, the comment cursor, and accumulated
 * discussion notes. Losing it degrades gracefully (fresh session, cursor
 * reset to now).
 */
export interface ItemState {
  sessionId?: string;
  /** ISO timestamp of the newest processed comment. */
  lastCommentIso?: string;
  /** Non-command approver comments accumulated for the next stage prompt. */
  pendingNotes?: string[];
  planPath?: string;
}

export interface BridgeState {
  items: Record<string, ItemState>;
}

export class StateStore {
  private state: BridgeState = { items: {} };

  constructor(private readonly filePath: string) {
    if (existsSync(filePath)) {
      try {
        this.state = JSON.parse(readFileSync(filePath, 'utf8')) as BridgeState;
      } catch {
        this.state = { items: {} };
      }
    }
  }

  item(todoId: string): ItemState {
    return (this.state.items[todoId] ??= {});
  }

  update(todoId: string, patch: Partial<ItemState>): void {
    Object.assign(this.item(todoId), patch);
    this.save();
  }

  forget(todoId: string): void {
    delete this.state.items[todoId];
    this.save();
  }

  private save(): void {
    writeFileSync(this.filePath, JSON.stringify(this.state, null, 2), { mode: 0o600 });
  }
}
