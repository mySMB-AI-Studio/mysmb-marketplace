export type ComputedFunction = (args: Record<string, unknown>) => unknown;
export interface CompositeComponentDef {
    kind: 'composite';
    spec: {
        root: string;
        elements: Record<string, unknown>;
    };
    props?: string[];
}
/**
 * Local subset of the host's `@json-render/core` `StateStore` — just the two
 * members every action actually needs. Kept minimal and dependency-free
 * (widget-elements can't resolve `@json-render/core` in an isolated plugin
 * build unless it's installed locally) rather than importing the real type.
 */
export interface PluginActionStateStore {
    /** Read a value by JSON Pointer path (e.g. "/ui/slaResult"). */
    get: (path: string) => unknown;
    /** Write a value by JSON Pointer path and notify subscribers. */
    set: (path: string, value: unknown) => void;
}
export interface PluginWidgetActionContext {
    /** The widget's local state store. Optional so the type still matches the
     *  host if it ever calls a handler without one. */
    store?: PluginActionStateStore;
}
export interface PluginWidgetAction {
    description: string;
    schema: unknown;
    handler: (params: Record<string, unknown>, ctx: PluginWidgetActionContext) => Promise<void> | void;
}
export interface PluginElementsModule {
    slug: string;
    components?: Record<string, CompositeComponentDef>;
    functions?: Record<string, ComputedFunction>;
    actions?: Record<string, PluginWidgetAction>;
}
