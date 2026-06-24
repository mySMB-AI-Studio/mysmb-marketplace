import type { ComputedFunction, PluginElementsModule } from './types';

/**
 * Map a Salesforce Opportunity Probability (0–100) to a semantic tone.
 * >= 70 → "success", >= 40 → "accent", < 40 → "warning".
 *
 * Args: { value: number }
 *
 * Spec example:
 *   { "$computed": "salesforce_probability_tone", "args": { "value": { "$item": "Probability" } } }
 */
const probability_tone: ComputedFunction = (args) => {
  const v = Number(args.value ?? 0);
  if (v >= 70) return 'success';
  if (v >= 40) return 'accent';
  return 'warning';
};

const elements: PluginElementsModule = {
  slug: 'salesforce',
  functions: { probability_tone },
};

export default elements;
