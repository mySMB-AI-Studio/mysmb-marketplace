/**
 * Xero machine-to-machine auth.
 *
 * Uses the client-credentials grant type against Xero's identity endpoint
 * to obtain an app-scoped access token, caches it in memory, and refreshes
 * when it is close to expiring. There is no interactive user OAuth.
 */
const TOKEN_URL = "https://identity.xero.com/connect/token";
const EXPIRY_SKEW_MS = 60_000; // refresh a minute early
export class XeroTokenProvider {
    creds;
    cached = null;
    inflight = null;
    constructor(creds) {
        this.creds = creds;
    }
    async getAccessToken() {
        const now = Date.now();
        if (this.cached && this.cached.expiresAt - EXPIRY_SKEW_MS > now) {
            return this.cached.accessToken;
        }
        if (this.inflight)
            return this.inflight;
        this.inflight = this.fetchToken().finally(() => {
            this.inflight = null;
        });
        return this.inflight;
    }
    async fetchToken() {
        const basic = Buffer.from(`${this.creds.clientId}:${this.creds.clientSecret}`).toString("base64");
        const body = new URLSearchParams();
        body.set("grant_type", "client_credentials");
        // TODO(xero): confirm the exact scope list required for the custom
        // connection flow for the endpoints used by this plugin.
        body.set("scope", "accounting.transactions accounting.contacts accounting.reports.read");
        const res = await fetch(TOKEN_URL, {
            method: "POST",
            headers: {
                Authorization: `Basic ${basic}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: body.toString(),
        });
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(`xero token request failed: ${res.status} ${res.statusText} ${text}`);
        }
        const json = (await res.json());
        if (!json.access_token || typeof json.expires_in !== "number") {
            throw new Error("xero token response missing access_token or expires_in");
        }
        this.cached = {
            accessToken: json.access_token,
            expiresAt: Date.now() + json.expires_in * 1000,
        };
        return this.cached.accessToken;
    }
    getTenantId() {
        return this.creds.tenantId;
    }
}
