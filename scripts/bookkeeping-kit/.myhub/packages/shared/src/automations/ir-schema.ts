/**
 * Flow IR — the canonical, stored, versioned form of an automation
 * (architecture/technical/automations.md §5).
 *
 * Structure over code: the graph, triggers and typed node envelopes
 * (`params` in / `outputs` out) live in JSON so the editor can render real
 * form controls and the design-time content picker without touching the AI;
 * the flexible part is ordinary multi-line Python inside `nodes[].code`.
 *
 * This module is stage 1a of the validation pipeline (shape). Stage 1b —
 * cross-references (bindings resolve upstream, event types exist in the
 * catalog, tree integrity) — lives in ir-semantics.ts so schema parsing stays
 * dependency-free.
 */

import { z } from 'zod';

/** v1 param control vocabulary — the editor renders these as real inputs. */
export const PARAM_CONTROLS = [
  'text',
  'number',
  'select',
  'checkboxes',
  'user-picker',
  'group-picker',
  'form-picker',
  'template-picker',
  'form-template-picker',
  'report-picker',
  'client-picker',
  'portal-picker',
  'date',
  'cron',
  'hidden',
] as const;
export type ParamControl = (typeof PARAM_CONTROLS)[number];

const identifier = z
  .string()
  .regex(/^[a-z_][a-z0-9_]*$/, 'must be a snake_case identifier');

export const paramDefSchema = z
  .object({
    name: identifier,
    /** Mini type language — see validation/stubs TYPE_MAP (str, uuid, list[dict], PortalReport …). */
    type: z.string().min(1),
    control: z.enum(PARAM_CONTROLS),
    label: z.string().optional(),
    description: z.string().optional(),
    required: z.boolean().default(false),
    /** Choices for select/checkboxes controls. */
    options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
    /** A single {{ … }} expression (bindings.ts). XOR with `value`. */
    binding: z.string().optional(),
    /** Literal value. XOR with `binding`. */
    value: z.unknown().optional(),
  })
  .refine((p) => !(p.binding !== undefined && p.value !== undefined), {
    message: 'a param may set binding or value, not both',
  });
export type ParamDef = z.infer<typeof paramDefSchema>;

export const outputDefSchema = z.object({
  name: identifier,
  type: z.string().min(1),
  description: z.string().optional(),
});
export type OutputDef = z.infer<typeof outputDefSchema>;

const pythonNodeSchema = z.object({
  id: identifier,
  kind: z.literal('python'),
  title: z.string().min(1),
  params: z.array(paramDefSchema).default([]),
  /** Multi-line Python. Only declared outputs cross the node boundary. */
  code: z.string().min(1),
  outputs: z.array(outputDefSchema).default([]),
  /** AI-written 1–2 sentence plain-English description shown in the step panel. */
  summary: z.string().max(300).optional(),
});
export type PythonNode = z.infer<typeof pythonNodeSchema>;

const ifNodeSchema = z.object({
  id: identifier,
  kind: z.literal('if'),
  title: z.string().min(1),
  /** A Python expression over trigger/params/steps (evaluated in the sandbox). */
  cond: z.string().min(1),
  then: z.array(identifier),
  else: z.array(identifier).default([]),
  summary: z.string().max(300).optional(),
});
export type IfNode = z.infer<typeof ifNodeSchema>;

export const FOREACH_MAX_ITERATIONS = 500;

const foreachNodeSchema = z.object({
  id: identifier,
  kind: z.literal('foreach'),
  title: z.string().min(1),
  /** Binding expression that must resolve to a list. */
  items: z.string().min(1),
  /** Name the body's code sees the current element under (binding root `item`). */
  itemVar: identifier,
  body: z.array(identifier).min(1),
  /**
   * Hard bound on iterations (structural runaway protection). The loop
   * implicitly outputs `results: list` — one entry per iteration holding the
   * body's LAST node's outputs; body-node outputs are not addressable after
   * the loop.
   */
  maxIterations: z.number().int().positive().max(FOREACH_MAX_ITERATIONS).default(FOREACH_MAX_ITERATIONS),
  summary: z.string().max(300).optional(),
});
export type ForeachNode = z.infer<typeof foreachNodeSchema>;

export const flowNodeSchema = z.discriminatedUnion('kind', [
  pythonNodeSchema,
  ifNodeSchema,
  foreachNodeSchema,
]);
export type FlowNode = z.infer<typeof flowNodeSchema>;

export const triggerSpecSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('manual') }),
  z.object({
    kind: z.literal('schedule'),
    /** 5-field cron, evaluated by croner in the given IANA timezone. */
    cron: z.string().min(1),
    timezone: z.string().min(1).default('UTC'),
  }),
  z.object({
    kind: z.literal('event'),
    eventType: z.string().min(1),
    /** Shallow-equality object matched against the event `subject`. */
    filter: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
  }),
  z.object({ kind: z.literal('api') }),
]);
export type TriggerSpec = z.infer<typeof triggerSpecSchema>;

export const MAX_NODES = 50;

export const flowIrSchema = z.object({
  irVersion: z.literal(1),
  name: z.string().min(1),
  description: z.string().optional(),
  /** Automation-level inputs — rendered as the manual-run form / API body schema. */
  params: z.array(paramDefSchema).default([]),
  triggers: z.array(triggerSpecSchema).min(1),
  nodes: z.array(flowNodeSchema).min(1).max(MAX_NODES),
  /** Top-level execution order; branch/body nodes are referenced by their parents. */
  rootOrder: z.array(identifier).min(1),
});
export type FlowIr = z.infer<typeof flowIrSchema>;

/** Convenience: parse + throw with Zod's formatted message. */
export function parseFlowIr(value: unknown): FlowIr {
  return flowIrSchema.parse(value);
}
