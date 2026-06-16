// MyHub `widgets-system/system` is the canonical source of truth for the
// system primitives (Card, Row, Heading, etc.) plus the $computed helpers.
// We import them live via vite aliases so widgets render here exactly as they
// do in production — instead of drifting against a hand-maintained subset.
//
// We deliberately DON'T import MyHub's `widgetActions`. Those bind to
// MyHub-specific infrastructure (toast, todo-modal, MCP cache invalidation).
// The harness wires actions through its own MCP handler map in App.tsx.
//
// Discovery is done at build time in vite.config.ts; if MyHub isn't on disk,
// the alias falls back and Vite logs a clear error.

import * as React from 'react';
// Import directly from `./components` and `./functions` — NOT from the
// system barrel (`./index`). The barrel re-exports `widgetActions` which
// transitively imports MyHub-only modules (call-tool, todo-modal store)
// that don't exist in the harness.
// @ts-expect-error — alias is set up in vite.config.ts; TS doesn't know about it.
import * as systemComponents from '@myhub-widgets-system/system/components';
// @ts-expect-error — alias is set up in vite.config.ts.
import { widgetFunctions, cellFormatters, cellToneFormatters } from '@myhub-widgets-system/system/functions';

// Filter out the type-only / non-component exports from `import * as` —
// SectionProps and friends would show up as `undefined` here. MyHub does the
// same destructure in its system/index.ts; we mirror that without going
// through the barrel.
const componentNames = [
  'Card', 'Header', 'Body', 'Section', 'Stack', 'Row', 'Grid',
  'Heading', 'Subtitle', 'Eyebrow', 'Text', 'Caption',
  'Stat', 'Dot', 'Badge', 'ProgressBar', 'BarChart', 'Sparkline', 'Delta', 'Avatar', 'Icon',
  'Button', 'IconButton', 'Checkbox', 'TextInput', 'NumberInput', 'DateInput',
  'Select', 'FormRow', 'KeyValue', 'ListItem', 'ActivityItem', 'Table',
  'Divider', 'Spinner', 'Skeleton', 'Empty', 'Overlay', 'OverlayClose', 'RichHtml',
] as const;

export const components: Record<string, React.ComponentType<any>> = {};
for (const name of componentNames) {
  const fn = (systemComponents as Record<string, unknown>)[name];
  if (typeof fn === 'function') components[name] = fn as React.ComponentType<any>;
  else console.warn(`[harness] MyHub system component "${name}" missing — check widgets-system/system/components.tsx`);
}

// Merge functions + cell helpers into the namespace json-render's $computed
// reads from. MyHub does the same wiring in its renderer at runtime.
export const functions: Record<string, (a: any) => unknown> = {
  ...(widgetFunctions ?? {}),
  ...(cellFormatters ?? {}),
  ...(cellToneFormatters ?? {}),
};

// Fallback component for unknown types — shown when a widget references a
// component the system doesn't ship (or hasn't shipped yet). Keeps the
// render alive instead of returning null and yielding a cryptic
// "cannot convert undefined or null to object" from json-render.
export const Unknown = ({ __type, children }: { __type?: string; children?: React.ReactNode }) => (
  <div className="inline-block rounded border border-dashed border-warning bg-warning/10 px-1.5 py-0.5 text-[10px] font-mono text-warning">
    ?{__type ?? 'unknown'}
    {children ? <div className="mt-1">{children}</div> : null}
  </div>
);
