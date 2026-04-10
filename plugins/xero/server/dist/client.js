/**
 * Thin wrapper around the xero-node SDK that injects a fresh access token
 * for every call and always scopes requests to the configured tenant.
 *
 * Tool modules should go through this wrapper rather than touching
 * xero-node directly, so there is exactly one place that knows how to
 * attach credentials.
 */
import { XeroClient } from "xero-node";
export class XeroApiClient {
    tokens;
    sdk;
    constructor(tokens) {
        this.tokens = tokens;
        // xero-node's XeroClient wants a config even when we are supplying our
        // own tokens. The clientId/clientSecret below are never used for auth
        // (we manage the token ourselves via XeroTokenProvider) but the SDK
        // requires the fields to be present.
        this.sdk = new XeroClient({
            clientId: "unused",
            clientSecret: "unused",
            grantType: "client_credentials",
        });
    }
    get tenantId() {
        return this.tokens.getTenantId();
    }
    /**
     * Returns the xero-node accountingApi, pre-authenticated with a fresh
     * access token. Tool modules call it like:
     *   const api = await client.accounting();
     *   await api.getInvoices(client.tenantId, ...);
     */
    async accounting() {
        const token = await this.tokens.getAccessToken();
        // xero-node reads the token from its internal TokenSet; setting it
        // explicitly before each call is the safest pattern since we may be
        // refreshing between calls.
        this.sdk.setTokenSet({
            access_token: token,
            token_type: "Bearer",
            expires_in: 1800,
        });
        return this.sdk.accountingApi;
    }
}
