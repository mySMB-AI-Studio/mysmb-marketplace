import { readFileSync, writeFileSync, existsSync } from 'node:fs';
export class StateStore {
    filePath;
    state = { items: {} };
    constructor(filePath) {
        this.filePath = filePath;
        if (existsSync(filePath)) {
            try {
                this.state = JSON.parse(readFileSync(filePath, 'utf8'));
            }
            catch {
                this.state = { items: {} };
            }
        }
    }
    item(todoId) {
        return (this.state.items[todoId] ??= {});
    }
    update(todoId, patch) {
        Object.assign(this.item(todoId), patch);
        this.save();
    }
    forget(todoId) {
        delete this.state.items[todoId];
        this.save();
    }
    save() {
        writeFileSync(this.filePath, JSON.stringify(this.state, null, 2), { mode: 0o600 });
    }
}
