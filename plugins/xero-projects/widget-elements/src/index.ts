/**
 * xero-projects — widget-elements module
 *
 * Exports:
 *   - default `PluginElementsModule` (slug only — no functions/components for v1)
 *   - named `portalContracts` registry (Zod schemas for portal data maps)
 */

import { z } from 'zod';
import type { PluginElementsModule, PortalContracts } from './types';

// ── Portal canonical contracts ───────────────────────────────────────
// Shape produced by the `staffed-employee-time-entries` data map.
const TimeEntry = z.object({
  id:              z.string().uuid(),
  userId:          z.string().uuid(),
  userName:        z.string(),
  projectId:       z.string().uuid(),
  projectName:     z.string(),
  taskId:          z.string().uuid(),
  taskName:        z.string(),
  dateUtc:         z.string().datetime(),
  durationMinutes: z.number().int().min(0),
  description:     z.string().nullable().optional(),
});

export const portalContracts: PortalContracts = {
  TimeEntry,
};

const elements: PluginElementsModule = {
  slug: 'xero-projects',
  functions: {},
};

export default elements;
