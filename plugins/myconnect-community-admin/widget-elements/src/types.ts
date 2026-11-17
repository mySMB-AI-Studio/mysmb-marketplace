/**
 * Local mirror of the host's plugin contract.
 *
 * Plugins compile in isolation and don't have access to the myHubV2 workspace,
 * so we declare the minimum surface area we need here. The host
 * (`@myhub/widget-tokens`) re-exports an equivalent shape — values are
 * matched structurally at load time, not nominally.
 */

export type ComputedFunction = (args: Record<string, unknown>) => unknown;

export interface CompositeComponentDef {
  kind: 'composite';
  spec: { root: string; elements: Record<string, unknown> };
  props?: string[];
}

/**
 * Subset of `@json-render/core`'s `StateStore`: the tile's own state, the
 * same store `$state` reads in the widget spec.
 */
export interface PluginActionStateStore {
  get: (path: string) => unknown;
  set: (path: string, value: unknown) => void;
}

/** Which credential answered an isolated tool call (non-secret opaque ids). */
export interface PluginToolProvenance {
  source: 'personal' | 'service';
  accountId?: string;
  serviceConnectionId?: string;
}

export type PluginToolResult =
  | { ok: true; data: unknown; provenance: PluginToolProvenance }
  | { ok: false; code: string; error: string };

/**
 * The host's isolated tool calls (myHubV2 widgets-system/plugin-tools.ts):
 * the reply comes back directly, is never cached or written to widget state,
 * every call in a session uses the same account, and the session ends when
 * the tile unmounts or its connection or signed-in user changes.
 */
export interface PluginToolSession {
  readonly signal: AbortSignal;
  call(
    mcp: string,
    tool: string,
    params?: Record<string, unknown>,
    options?: { signal?: AbortSignal },
  ): Promise<PluginToolResult>;
}

/**
 * The host calls every plugin action as `handler(params, { store, tools })`
 * (myHubV2 widgets-system/registry.ts). Both are optional: older hosts pass
 * no `tools`, and a handler must fail closed rather than fall back.
 */
export interface PluginWidgetActionContext {
  store?: PluginActionStateStore;
  tools?: PluginToolSession;
}

export interface PluginWidgetAction {
  description: string;
  schema: unknown;
  handler: (params: Record<string, unknown>, ctx: PluginWidgetActionContext) => Promise<void> | void;
}

export interface PluginElementsModule {
  /** Plugin slug — must match the marketplace plugin name. */
  slug: string;
  components?: Record<string, CompositeComponentDef>;
  functions?: Record<string, ComputedFunction>;
  actions?: Record<string, PluginWidgetAction>;
}
