/**
 * Local mirror of the host's plugin contract. Plugins compile in
 * isolation and don't have access to the myHubV2 workspace, so we
 * declare the minimum surface area we need here. The host
 * (`@myhub/widget-tokens`) re-exports an equivalent shape — values
 * are matched structurally at load time, not nominally.
 */

export type ComputedFunction = (args: Record<string, unknown>) => unknown;

export interface CompositeComponentDef {
  kind: 'composite';
  spec: { root: string; elements: Record<string, unknown> };
  props?: string[];
}

export interface PluginWidgetAction {
  description: string;
  schema: unknown;
  handler: (params: Record<string, unknown>) => Promise<void> | void;
}

export interface PluginElementsModule {
  slug: string;
  components?: Record<string, CompositeComponentDef>;
  functions?: Record<string, ComputedFunction>;
  actions?: Record<string, PluginWidgetAction>;
}
