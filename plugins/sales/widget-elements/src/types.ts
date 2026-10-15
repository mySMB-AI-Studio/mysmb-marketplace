export type ComputedFunction = (args: Record<string, unknown>) => unknown;

export interface PluginElementsModule {
  slug: string;
  functions?: Record<string, ComputedFunction>;
}
