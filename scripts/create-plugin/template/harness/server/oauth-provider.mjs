// File-backed OAuthClientProvider, one per MCP server. Persists everything the
// MCP SDK's auth flow needs — dynamic client registration, PKCE verifier,
// tokens, discovery state — to .harness-cache/oauth/<server>.json so the user
// doesn't re-authorize after every harness restart.
//
// `redirectToAuthorization(url)` doesn't actually redirect the node process;
// it stashes the URL on a deferred promise that the HTTP endpoint awaits and
// returns to the browser. The browser opens the URL in a new tab; when the
// auth server redirects back to /api/oauth/callback, the server calls
// `transport.finishAuth(code)` which calls `provider.tokens()` /
// `saveTokens()` to complete the exchange.

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';

export class FileOAuthProvider {
  /**
   * @param {object} opts
   * @param {string} opts.cacheDir   Absolute path to .harness-cache/oauth
   * @param {string} opts.serverKey  Stable id (the MCP server name) — used as filename
   * @param {string} opts.redirectUrl `http://localhost:5174/api/oauth/callback`
   * @param {string} opts.clientName  Shown to the user on the consent screen
   * @param {(serverKey: string, url: URL) => void} opts.onRedirect  Called when the SDK wants to redirect.
   */
  constructor({ cacheDir, serverKey, redirectUrl, clientName, onRedirect }) {
    this.cacheDir = cacheDir;
    this.serverKey = serverKey;
    this._redirectUrl = redirectUrl;
    this._clientName = clientName ?? 'mySMB plugin harness';
    this._onRedirect = onRedirect;
    this._file = join(cacheDir, `${encodeURIComponent(serverKey)}.json`);
    this._state = this._load();
  }

  _load() {
    if (!existsSync(this._file)) return {};
    try { return JSON.parse(readFileSync(this._file, 'utf8')); } catch { return {}; }
  }
  _save() {
    mkdirSync(dirname(this._file), { recursive: true });
    writeFileSync(this._file, JSON.stringify(this._state, null, 2));
  }

  // ── Interface ─────────────────────────────────────────────────────

  get redirectUrl() { return this._redirectUrl; }

  get clientMetadata() {
    return {
      client_name: this._clientName,
      redirect_uris: [this._redirectUrl],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none', // public client
    };
  }

  state() {
    // Generate (and persist) a random state. The callback handler uses this
    // to look up which server is being authorized.
    const s = randomBytes(16).toString('base64url');
    this._state.pendingState = s;
    this._save();
    return s;
  }
  pendingState() { return this._state.pendingState; }

  clientInformation() { return this._state.clientInformation; }
  saveClientInformation(info) {
    this._state.clientInformation = info;
    this._save();
  }

  tokens() { return this._state.tokens; }
  saveTokens(tokens) {
    this._state.tokens = tokens;
    this._save();
  }

  codeVerifier() {
    if (!this._state.codeVerifier) throw new Error(`no codeVerifier for "${this.serverKey}"`);
    return this._state.codeVerifier;
  }
  saveCodeVerifier(codeVerifier) {
    this._state.codeVerifier = codeVerifier;
    this._save();
  }

  discoveryState() { return this._state.discovery; }
  saveDiscoveryState(state) {
    this._state.discovery = state;
    this._save();
  }

  invalidateCredentials(scope) {
    if (scope === 'all') this._state = {};
    else if (scope in this._state) delete this._state[scope];
    this._save();
  }

  redirectToAuthorization(url) {
    // Don't actually redirect — surface the URL to the caller of /start so
    // the browser can window.open() it. We always have a fresh pending state
    // saved by state() right before this call.
    this._onRedirect(this.serverKey, url);
  }

  reset() {
    this._state = {};
    if (existsSync(this._file)) try { unlinkSync(this._file); } catch { /* ignore */ }
  }
}
