/**
 * Zod schema for the FormSchema jsonb stored in forms.schema.
 *
 * v1 question types follow the task spec (not the earlier architecture draft):
 *   short_text | long_text | single_choice | multi_choice | scale_1_5 | date | yes_no | lookup
 *
 * Exported so the frontend form-builder can reuse the validator to catch bad
 * definitions before submitting to the API.
 *
 * The `validateResponses` export validates a submitted answers map against a
 * locked FormSchema — called at submitResponse time. Returns an array of
 * validation error messages (empty = valid).
 *
 * Design: architecture/technical/client-portal.md § "Forms"
 * Design: docs/superpowers/specs/2026-06-11-form-workq-items-design.md § "3. Lookup question type"
 */

import { z } from 'zod';

// ── Question variants ──────────────────────────────────────────────────────────

const baseQuestion = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  required: z.boolean().optional(),
});

export const shortTextQuestionSchema = baseQuestion.extend({
  type: z.literal('short_text'),
  placeholder: z.string().optional(),
  maxLength: z.number().int().positive().optional(),
});

export const longTextQuestionSchema = baseQuestion.extend({
  type: z.literal('long_text'),
  placeholder: z.string().optional(),
  maxLength: z.number().int().positive().optional(),
});

export const singleChoiceQuestionSchema = baseQuestion.extend({
  type: z.literal('single_choice'),
  options: z.array(z.string().min(1)).min(2),
});

export const multiChoiceQuestionSchema = baseQuestion.extend({
  type: z.literal('multi_choice'),
  options: z.array(z.string().min(1)).min(2),
  minSelections: z.number().int().nonnegative().optional(),
  maxSelections: z.number().int().positive().optional(),
});

export const scale1to5QuestionSchema = baseQuestion.extend({
  type: z.literal('scale_1_5'),
  lowLabel: z.string().optional(),
  highLabel: z.string().optional(),
});

export const dateQuestionSchema = baseQuestion.extend({
  type: z.literal('date'),
});

export const yesNoQuestionSchema = baseQuestion.extend({
  type: z.literal('yes_no'),
});

/**
 * Lookup question type — respondent picks a structured entity reference.
 * Answer is stored as `{ id: string, label: string }` snapshot.
 *
 * `entity` drives which fill-time options endpoint is queried and which
 * portal-mode restrictions apply (portal mode: 'user', 'workq_item',
 * 'employee', 'client', and 'contact' scoped to the active portal).
 *
 * No `binding` field lives here — whether a lookup is pre-filled (bound) is
 * decided by the delivery context (item bindings map or template engine);
 * the question definition itself is context-free.
 */
const staticLookupEntitySchema = z.enum([
  'user',
  'employee',
  'client',
  'contact',
  'workq_item',
]);

/**
 * Records Engine: a lookup may also target a tenant-defined record type,
 * written `record:<slug>`. It cannot be part of the enum because published
 * types are tenant DATA — the slug shape is validated against exactly the
 * pattern the database CHECK enforces on `record_types.slug`, so a crafted
 * value can never be stored.
 */
export const RECORD_LOOKUP_RE = /^record:[a-z][a-z0-9_]{1,39}$/;

/**
 * A Records Engine type as a lookup source, e.g. `record:purchase_orders`.
 *
 * `z.custom` rather than `z.string().regex(...)`: a plain string branch would
 * make the inferred union collapse to `string` (TypeScript absorbs literals
 * into `string`), which silently disables every exhaustiveness check and
 * `Record<LookupEntity, …>` map in the app. The template-literal type survives
 * the union, so the compiler still forces callers to handle this arm.
 */
export const recordLookupEntitySchema = z.custom<`record:${string}`>(
  (value) => typeof value === 'string' && RECORD_LOOKUP_RE.test(value),
  { message: 'must be record:<slug> with a lowercase snake_case slug' },
);

export const lookupEntitySchema = z.union([
  staticLookupEntitySchema,
  recordLookupEntitySchema,
]);

export type StaticLookupEntity = z.infer<typeof staticLookupEntitySchema>;
export type LookupEntity = z.infer<typeof lookupEntitySchema>;

/** `record:supplier` → `supplier`; null for the built-in entities. */
export function recordLookupSlug(entity: string): string | null {
  return RECORD_LOOKUP_RE.test(entity) ? entity.slice('record:'.length) : null;
}

export const lookupQuestionSchema = baseQuestion.extend({
  type: z.literal('lookup'),
  entity: lookupEntitySchema,
});

/**
 * Discriminated union of all v1 question types. Zod's `discriminatedUnion`
 * is used for efficient parsing (no need to try every branch).
 */
export const questionSchema = z.discriminatedUnion('type', [
  shortTextQuestionSchema,
  longTextQuestionSchema,
  singleChoiceQuestionSchema,
  multiChoiceQuestionSchema,
  scale1to5QuestionSchema,
  dateQuestionSchema,
  yesNoQuestionSchema,
  lookupQuestionSchema,
]);

export type Question = z.infer<typeof questionSchema>;

// ── Section ───────────────────────────────────────────────────────────────────

export const sectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  questions: z.array(questionSchema).min(1),
});

export type Section = z.infer<typeof sectionSchema>;

// ── FormSchema ────────────────────────────────────────────────────────────────

export const formSchemaSchema = z
  .object({
    version: z.literal(1),
    title: z.string().min(1),
    description: z.string().optional(),
    sections: z.array(sectionSchema).min(1),
  })
  .refine(
    (fs) => {
      // Question IDs must be unique across the whole form.
      const ids = fs.sections.flatMap((s) => s.questions.map((q) => q.id));
      return ids.length === new Set(ids).size;
    },
    { message: 'Question IDs must be unique across all sections' },
  );

export type FormSchema = z.infer<typeof formSchemaSchema>;

// ── Response validation ───────────────────────────────────────────────────────

/**
 * Validate a submitted answers map against a locked FormSchema.
 *
 * `answers` is `{ [questionId]: string | string[] | number | boolean }`.
 *
 * Returns an array of human-readable error strings (empty = valid).
 * Called by formManager.submitResponse before writing to the DB.
 */
export function validateResponses(
  schema: FormSchema,
  answers: Record<string, unknown>,
): string[] {
  const errors: string[] = [];
  const allQuestions = schema.sections.flatMap((s) => s.questions);

  for (const q of allQuestions) {
    const ans = answers[q.id];

    // Required check.
    // For lookup questions the answer is an object; "empty" means id is absent or blank.
    if (q.required) {
      const isEmpty =
        q.type === 'lookup'
          ? ans === undefined ||
            ans === null ||
            typeof ans !== 'object' ||
            !('id' in (ans as object)) ||
            (ans as { id: unknown }).id === '' ||
            (ans as { id: unknown }).id == null
          : ans === undefined || ans === null || ans === '';
      if (isEmpty) {
        errors.push(`Question "${q.label}" is required`);
        continue;
      }
    }

    // Skip further validation when the field was not answered.
    if (ans === undefined || ans === null) continue;

    switch (q.type) {
      case 'short_text':
      case 'long_text': {
        if (typeof ans !== 'string') {
          errors.push(`Question "${q.label}" must be a string`);
        } else if (q.maxLength !== undefined && ans.length > q.maxLength) {
          errors.push(`Question "${q.label}" exceeds max length of ${q.maxLength}`);
        }
        break;
      }
      case 'single_choice': {
        if (typeof ans !== 'string') {
          errors.push(`Question "${q.label}" must be a string`);
        } else if (!q.options.includes(ans)) {
          errors.push(`Question "${q.label}" answer must be one of: ${q.options.join(', ')}`);
        }
        break;
      }
      case 'multi_choice': {
        if (!Array.isArray(ans)) {
          errors.push(`Question "${q.label}" must be an array`);
        } else {
          const invalid = (ans as unknown[]).filter((v) => typeof v !== 'string' || !q.options.includes(v as string));
          if (invalid.length > 0) {
            errors.push(`Question "${q.label}" contains invalid options`);
          }
          if (q.minSelections !== undefined && (ans as unknown[]).length < q.minSelections) {
            errors.push(`Question "${q.label}" requires at least ${q.minSelections} selection(s)`);
          }
          if (q.maxSelections !== undefined && (ans as unknown[]).length > q.maxSelections) {
            errors.push(`Question "${q.label}" allows at most ${q.maxSelections} selection(s)`);
          }
        }
        break;
      }
      case 'scale_1_5': {
        const n = Number(ans);
        if (!Number.isInteger(n) || n < 1 || n > 5) {
          errors.push(`Question "${q.label}" must be an integer between 1 and 5`);
        }
        break;
      }
      case 'date': {
        if (typeof ans !== 'string' || Number.isNaN(Date.parse(ans))) {
          errors.push(`Question "${q.label}" must be a valid date string (ISO 8601)`);
        }
        break;
      }
      case 'yes_no': {
        if (typeof ans !== 'boolean') {
          errors.push(`Question "${q.label}" must be a boolean`);
        }
        break;
      }
      case 'lookup': {
        // Answer must be `{ id: string, label: string }`.
        // Extra fields are tolerated (snapshot may carry sublabel etc.) consistent
        // with the lenient-extras convention used by other question types.
        if (
          typeof ans !== 'object' ||
          ans === null ||
          Array.isArray(ans) ||
          typeof (ans as Record<string, unknown>).id !== 'string' ||
          typeof (ans as Record<string, unknown>).label !== 'string'
        ) {
          errors.push(`Question "${q.label}" must be a lookup answer { id, label }`);
        }
        break;
      }
    }
  }

  // Warn about unknown keys (don't error — the form may evolve; be lenient on extras).
  const knownIds = new Set(allQuestions.map((q) => q.id));
  for (const key of Object.keys(answers)) {
    if (!knownIds.has(key)) {
      errors.push(`Unknown question ID "${key}" in responses`);
    }
  }

  return errors;
}
