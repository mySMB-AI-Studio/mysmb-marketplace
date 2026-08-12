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
