/**
 * Report data bindings — the manifest that makes an artifact a LIVE report.
 *
 * A live report is HTML + this manifest: the document carries render and
 * mapping code, the manifest declares HOW to fetch (which MCP tool, which
 * params) and WHAT is interactive (declared inputs). Data itself is never
 * persisted — the hydrate route executes bindings at view time with the
 * viewer's credentials. Spec: architecture/technical/reports.md.
 *
 * The manifest is server-held state: hydration validates every request
 * against the row's stored copy, never against anything the HTML claims.
 * That is the security model — a report's generated JS can only ever request
 * parameter combinations declared here at generation time, so a malformed or
 * malicious document cannot turn the viewer's credentials into a free-form
 * tool-calling proxy.
 *
 * Validation is Zod (trust boundary — the manifest arrives from a model via
 * `artifact_save`), surfaced as `ArtifactValidationError` like every other
 * artifact normaliser so callers handle one error family.
 */

import { z } from 'zod';
import { ArtifactValidationError } from './normalize';

/** A report needing more than this is a dashboard. */
export const MAX_REPORT_BINDINGS = 12;
export const MAX_REPORT_INPUTS = 8;
export const MAX_BINDING_PARAMS = 20;

/**
 * Server-resolved context values — the same vocabulary widget data providers
 * use (`packages/shared/src/dashboard/data-provider.ts`), so authors and the
 * generation prompt reason about one list.
 */
export const REPORT_CONTEXT_SOURCES = [
  'session.userId',
  'session.tenantId',
  'now.iso',
  'now.epochMs',
  'now.date',
] as const;
export type ReportContextSource = (typeof REPORT_CONTEXT_SOURCES)[number];

const INPUT_NAME_RE = /^[a-z][a-z0-9_]{0,39}$/;
const BINDING_ID_RE = /^[a-z][a-z0-9_-]{0,63}$/;
const PARAM_KEY_RE = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
// MCP server slugs as they appear in plugin configs (`myhub-xero`, `deskcrm`).
const MCP_SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,99}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const inputNameSchema = z.string().regex(INPUT_NAME_RE, {
  message: 'input names are lowercase snake_case, max 40 chars',
});

const labelSchema = z.string().trim().min(1).max(80).optional();

/**
 * Declared inputs are the interactivity contract. Each carries a required
 * `default` so hydration (and snapshot capture) can always run without the
 * report supplying anything. `date` accepts the literal `'today'` default,
 * resolved to the current UTC date at hydrate time — a hard-coded date
 * default would go stale the day after generation.
 */
const enumInputSchema = z
  .object({
    name: inputNameSchema,
    label: labelSchema,
    type: z.literal('enum'),
    options: z
      .array(z.string().trim().min(1).max(80))
      .min(1)
      .max(12)
      .refine((opts) => new Set(opts).size === opts.length, {
        message: 'enum options must be unique',
      }),
    default: z.string(),
  })
  .strict()
  .refine((i) => i.options.includes(i.default), {
    message: 'enum default must be one of its options',
  });

const stringInputSchema = z
  .object({
    name: inputNameSchema,
    label: labelSchema,
    type: z.literal('string'),
    maxLength: z.number().int().min(1).max(500).default(200),
    default: z.string(),
  })
  .strict()
  .refine((i) => i.default.length <= i.maxLength, {
    message: 'string default exceeds its maxLength',
  });

const numberInputSchema = z
  .object({
    name: inputNameSchema,
    label: labelSchema,
    type: z.literal('number'),
    min: z.number().finite().optional(),
    max: z.number().finite().optional(),
    default: z.number().finite(),
  })
  .strict()
  .superRefine((i, ctx) => {
    if (i.min !== undefined && i.max !== undefined && i.min > i.max) {
      ctx.addIssue({ code: 'custom', message: 'number input min exceeds max' });
    }
    if (i.min !== undefined && i.default < i.min) {
      ctx.addIssue({ code: 'custom', message: 'number default below min' });
    }
    if (i.max !== undefined && i.default > i.max) {
      ctx.addIssue({ code: 'custom', message: 'number default above max' });
    }
  });

const dateInputSchema = z
  .object({
    name: inputNameSchema,
    label: labelSchema,
    type: z.literal('date'),
    default: z.union([
      z.literal('today'),
      z.string().regex(DATE_RE, { message: 'date default must be YYYY-MM-DD or "today"' }),
    ]),
  })
  .strict();

export const reportInputSchema = z.discriminatedUnion('type', [
  enumInputSchema,
  stringInputSchema,
  numberInputSchema,
  dateInputSchema,
]);
export type ReportInput = z.infer<typeof reportInputSchema>;

/**
 * Param kinds mirror the widget `ProviderParam` vocabulary (static / context)
 * plus `input` — the value comes from the report's own controls at request
 * time and must reference a declared input.
 */
export const reportBindingParamSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('static'),
      value: z.union([z.string().max(500), z.number().finite(), z.boolean(), z.null()]),
    })
    .strict(),
  z.object({ kind: z.literal('context'), source: z.enum(REPORT_CONTEXT_SOURCES) }).strict(),
  z.object({ kind: z.literal('input'), input: inputNameSchema }).strict(),
]);
export type ReportBindingParam = z.infer<typeof reportBindingParamSchema>;

export const reportBindingSchema = z
  .object({
    id: z.string().regex(BINDING_ID_RE, {
      message: 'binding ids are lowercase kebab/snake, max 64 chars',
    }),
    tool: z
      .object({
        mcp: z.string().regex(MCP_SLUG_RE, { message: 'tool.mcp is not a valid server slug' }),
        // Echoed into MCP protocol frames, never into headers — but still no
        // whitespace/control characters, which no real tool name contains.
        name: z
          .string()
          .min(1)
          .max(200)
          .regex(/^[^\s\u0000-\u001f\u007f]+$/, {
            message: 'tool.name must not contain whitespace or control characters',
          }),
      })
      .strict(),
    params: z
      .record(z.string().regex(PARAM_KEY_RE), reportBindingParamSchema)
      .default({})
      .refine((p) => Object.keys(p).length <= MAX_BINDING_PARAMS, {
        message: `a binding can carry at most ${MAX_BINDING_PARAMS} params`,
      }),
  })
  .strict();
export type ReportBinding = z.infer<typeof reportBindingSchema>;

export const reportDataBindingsSchema = z
  .object({
    inputs: z.array(reportInputSchema).max(MAX_REPORT_INPUTS).default([]),
    bindings: z.array(reportBindingSchema).min(1).max(MAX_REPORT_BINDINGS),
  })
  .strict()
  .superRefine((manifest, ctx) => {
    const inputNames = new Set<string>();
    for (const input of manifest.inputs) {
      if (inputNames.has(input.name)) {
        ctx.addIssue({ code: 'custom', message: `duplicate input name: ${input.name}` });
      }
      inputNames.add(input.name);
    }
    const bindingIds = new Set<string>();
    for (const binding of manifest.bindings) {
      if (bindingIds.has(binding.id)) {
        ctx.addIssue({ code: 'custom', message: `duplicate binding id: ${binding.id}` });
      }
      bindingIds.add(binding.id);
      for (const [key, param] of Object.entries(binding.params)) {
        if (param.kind === 'input' && !inputNames.has(param.input)) {
          ctx.addIssue({
            code: 'custom',
            message: `binding "${binding.id}" param "${key}" references undeclared input "${param.input}"`,
          });
        }
      }
    }
  });
export type ReportDataBindings = z.infer<typeof reportDataBindingsSchema>;

/**
 * Parse an untrusted manifest (from `artifact_save` or the HTTP API).
 * Returns the validated manifest or throws `ArtifactValidationError` with the
 * first issue spelled out — model-facing tools echo this message, so it must
 * say what to fix, not dump a Zod tree.
 */
export function parseReportDataBindings(value: unknown): ReportDataBindings {
  const result = reportDataBindingsSchema.safeParse(value);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first.path.length > 0 ? ` at ${first.path.join('.')}` : '';
    throw new ArtifactValidationError(`invalid dataBindings${path}: ${first.message}`);
  }
  return result.data;
}

/** A hydrate request's resolved input values — always fully populated. */
export type ResolvedReportInputs = Record<string, string | number>;

/**
 * Validate the input values a hydrate request supplied against the declared
 * inputs, filling defaults for anything omitted. Unknown keys are rejected —
 * an undeclared input reaching a tool call is exactly what the contract
 * exists to prevent.
 */
export function resolveHydrateInputs(
  manifest: ReportDataBindings,
  supplied: Record<string, unknown> | undefined,
  now: Date = new Date(),
): ResolvedReportInputs {
  const declared = new Map(manifest.inputs.map((i) => [i.name, i]));
  for (const key of Object.keys(supplied ?? {})) {
    if (!declared.has(key)) {
      // Name the legal set: this error travels back to a generating agent
      // revising a broken report, and "unknown" alone sends it guessing.
      const names = [...declared.keys()].join(', ') || 'none';
      throw new ArtifactValidationError(
        `unknown input: ${key} (declared inputs: ${names})`,
      );
    }
  }
  const resolved: ResolvedReportInputs = {};
  for (const input of manifest.inputs) {
    const raw = supplied?.[input.name];
    resolved[input.name] =
      raw === undefined
        ? resolveDefault(input, now)
        : validateInputValue(input, raw);
  }
  return resolved;
}

function resolveDefault(input: ReportInput, now: Date): string | number {
  if (input.type === 'date' && input.default === 'today') {
    return now.toISOString().slice(0, 10);
  }
  return input.default;
}

function validateInputValue(input: ReportInput, raw: unknown): string | number {
  switch (input.type) {
    case 'enum': {
      if (typeof raw !== 'string' || !input.options.includes(raw)) {
        throw new ArtifactValidationError(
          `input "${input.name}" must be one of: ${input.options.join(', ')}`,
        );
      }
      return raw;
    }
    case 'string': {
      if (typeof raw !== 'string' || raw.length > input.maxLength) {
        throw new ArtifactValidationError(
          `input "${input.name}" must be a string of at most ${input.maxLength} characters`,
        );
      }
      return raw;
    }
    case 'number': {
      if (typeof raw !== 'number' || !Number.isFinite(raw)) {
        throw new ArtifactValidationError(`input "${input.name}" must be a finite number`);
      }
      if (input.min !== undefined && raw < input.min) {
        throw new ArtifactValidationError(`input "${input.name}" must be >= ${input.min}`);
      }
      if (input.max !== undefined && raw > input.max) {
        throw new ArtifactValidationError(`input "${input.name}" must be <= ${input.max}`);
      }
      return raw;
    }
    case 'date': {
      if (typeof raw !== 'string' || !DATE_RE.test(raw) || !isRealDate(raw)) {
        throw new ArtifactValidationError(
          `input "${input.name}" must be a valid YYYY-MM-DD date`,
        );
      }
      return raw;
    }
  }
}

// Date.parse rolls out-of-range days over (2026-02-30 → March 2nd) instead of
// rejecting them, so calendar validity needs an explicit round-trip.
function isRealDate(value: string): boolean {
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
  );
}

/**
 * Materialise a binding's tool params for one hydrate call. Inputs must
 * already have passed `resolveHydrateInputs` — this function only assembles.
 */
export function resolveBindingParams(
  binding: ReportBinding,
  ctx: { userId: string; tenantId: string; now?: Date },
  inputs: ResolvedReportInputs,
): Record<string, unknown> {
  const now = ctx.now ?? new Date();
  const out: Record<string, unknown> = {};
  for (const [key, param] of Object.entries(binding.params)) {
    switch (param.kind) {
      case 'static':
        out[key] = param.value;
        break;
      case 'context':
        out[key] = resolveContextSource(param.source, ctx.userId, ctx.tenantId, now);
        break;
      case 'input':
        out[key] = inputs[param.input];
        break;
    }
  }
  return out;
}

function resolveContextSource(
  source: ReportContextSource,
  userId: string,
  tenantId: string,
  now: Date,
): string | number {
  switch (source) {
    case 'session.userId':
      return userId;
    case 'session.tenantId':
      return tenantId;
    case 'now.iso':
      return now.toISOString();
    case 'now.epochMs':
      return now.getTime();
    case 'now.date':
      return now.toISOString().slice(0, 10);
  }
}

/**
 * Built-in report data servers — binding targets the platform itself serves
 * (workspace activity / adoption / WorkQ aggregates), dispatched in-process by
 * the hydrate path instead of through the connector credential lane. The same
 * idea as the widget `todos`/`roster` built-ins.
 */
export const REPORT_BUILTIN_SERVERS = ['workspace'] as const;

export function isBuiltinReportServer(slug: string): boolean {
  return (REPORT_BUILTIN_SERVERS as readonly string[]).includes(slug);
}

/**
 * The distinct connector (MCP server) slugs a manifest touches — display
 * attribution for the library card and viewer meta line. Never authorization.
 * Built-in servers are excluded: they are platform data, not a connector the
 * viewer could (or should be asked to) connect.
 */
export function deriveReportConnectors(
  manifest: ReportDataBindings | null | undefined,
): string[] {
  if (!manifest) return [];
  return [
    ...new Set(
      manifest.bindings.map((b) => b.tool.mcp).filter((slug) => !isBuiltinReportServer(slug)),
    ),
  ].sort();
}

/**
 * Static consistency checks between a live report's HTML and its manifest —
 * run at every save so a report that would fail at view time is rejected
 * while the GENERATING AGENT is still in the turn and can fix it, instead of
 * erroring in front of the reader.
 *
 * Deliberately low-false-positive: only enforce what string-level analysis
 * can assert with confidence. The canonical catch (seen on QA, 2026-09-03):
 * generated JS calling `MyHubReport.getData('pnl', { fromDate: … })` — a
 * TOOL parameter name where a DECLARED input name belongs — which hydration
 * can only reject at runtime, in front of the user.
 */
export function validateReportDocument(
  html: string,
  manifest: ReportDataBindings,
): string[] {
  const issues: string[] = [];
  const bindingIds = new Set(manifest.bindings.map((b) => b.id));
  const inputNames = new Set(manifest.inputs.map((i) => i.name));
  const declaredInputs = [...inputNames].join(', ') || 'none';

  if (!/MyHubReport\s*\.\s*onData/.test(html)) {
    issues.push(
      'a live report must render from MyHubReport.onData(bundle => …) — the saved HTML never calls it',
    );
  }

  for (const id of bindingIds) {
    if (!html.includes(id)) {
      issues.push(
        `binding "${id}" is declared but never referenced in the document — its data could never render`,
      );
    }
  }

  // MyHubReport.getData('<id>'[, { key: … }]) — both arguments are checkable
  // when written as literals, which generated code overwhelmingly does.
  const getDataRe =
    /MyHubReport\s*\.\s*getData\s*\(\s*(['"`])([^'"`]+)\1\s*(?:,\s*\{([^}]*)\})?/g;
  for (const match of html.matchAll(getDataRe)) {
    const [, , id, inputsLiteral] = match;
    if (!bindingIds.has(id)) {
      issues.push(
        `MyHubReport.getData("${id}") does not match any declared binding (declared: ${[...bindingIds].join(', ')})`,
      );
    }
    // Skip objects using spread/computed members — not statically checkable.
    if (inputsLiteral === undefined || inputsLiteral.includes('...') || inputsLiteral.includes('[')) {
      continue;
    }
    for (const keyMatch of inputsLiteral.matchAll(/(?:^|[,{\s])([A-Za-z_$][\w$]*)\s*(?=:)/g)) {
      const key = keyMatch[1];
      if (!inputNames.has(key)) {
        issues.push(
          `MyHubReport.getData("${id}", { ${key}: … }) passes an undeclared input "${key}" — getData takes DECLARED input names (declared: ${declaredInputs}), never tool parameter names`,
        );
      }
    }
  }

  return issues;
}
