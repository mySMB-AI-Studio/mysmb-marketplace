/**
 * OAuth 2.1 (PKCE + dynamic client registration) against the workspace's MCP
 * authorization server. One interactive browser sign-in on first run — sign in
 * as the myConnect Builder service account — then rotating refresh tokens keep
 * the daemon authenticated (60-day idle window on the workspace AS).
 *
 * Everything (registered client, tokens, code verifier) persists to a single
 * JSON file next to the config so restarts never re-prompt.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
function openBrowser(url) {
    const platform = process.platform;
    const [cmd, args] = platform === 'win32'
        ? ['cmd', ['/c', 'start', '""', url.replace(/&/g, '^&')]]
        : platform === 'darwin'
            ? ['open', [url]]
            : ['xdg-open', [url]];
    try {
        spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref();
    }
    catch {
        // Non-fatal — the URL is printed to the console as the fallback.
    }
}
export class FileAuthProvider {
    filePath;
    callbackPort;
    data = {};
    constructor(filePath, callbackPort) {
        this.filePath = filePath;
        this.callbackPort = callbackPort;
        if (existsSync(filePath)) {
            try {
                this.data = JSON.parse(readFileSync(filePath, 'utf8'));
            }
            catch {
                this.data = {};
            }
        }
    }
    persist() {
        writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), { mode: 0o600 });
    }
    get redirectUrl() {
        return `http://127.0.0.1:${this.callbackPort}/callback`;
    }
    get clientMetadata() {
        return {
            client_name: 'myConnect Builder Bridge',
            redirect_uris: [this.redirectUrl],
            grant_types: ['authorization_code', 'refresh_token'],
            response_types: ['code'],
            token_endpoint_auth_method: 'none',
            scope: 'workq:read workq:write',
        };
    }
    clientInformation() {
        return this.data.clientInformation;
    }
    saveClientInformation(info) {
        this.data.clientInformation = info;
        this.persist();
    }
    tokens() {
        return this.data.tokens;
    }
    saveTokens(tokens) {
        this.data.tokens = tokens;
        this.persist();
    }
    redirectToAuthorization(authorizationUrl) {
        const url = authorizationUrl.toString();
        console.log('\n[mcb-bridge] Sign-in required. Opening browser…');
        console.log(`[mcb-bridge] If nothing opens, visit:\n  ${url}\n`);
        console.log('[mcb-bridge] Sign in as the "myConnect Builder" service account.');
        openBrowser(url);
    }
    saveCodeVerifier(codeVerifier) {
        this.data.codeVerifier = codeVerifier;
        this.persist();
    }
    codeVerifier() {
        if (!this.data.codeVerifier)
            throw new Error('No code verifier persisted');
        return this.data.codeVerifier;
    }
}
/** One-shot localhost server that resolves with the ?code= of the OAuth redirect. */
export function waitForCallback(port, timeoutMs = 5 * 60 * 1000) {
    return new Promise((resolve, reject) => {
        let server = null;
        const timer = setTimeout(() => {
            server?.close();
            reject(new Error(`Timed out after ${timeoutMs / 1000}s waiting for the OAuth redirect`));
        }, timeoutMs);
        server = createServer((req, res) => {
            const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);
            if (url.pathname !== '/callback') {
                res.writeHead(404).end();
                return;
            }
            const code = url.searchParams.get('code');
            const err = url.searchParams.get('error');
            res.writeHead(200, { 'content-type': 'text/html' });
            res.end(code
                ? '<h3>myConnect Builder bridge connected.</h3>You can close this tab.'
                : `<h3>Sign-in failed.</h3>${err ?? 'No authorization code returned.'}`);
            clearTimeout(timer);
            server?.close();
            if (code)
                resolve(code);
            else
                reject(new Error(`OAuth redirect returned error: ${err ?? 'no code'}`));
        });
        server.listen(port, '127.0.0.1');
    });
}
