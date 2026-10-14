import { z } from 'zod';

// ──────────────────────────────────────────────────────────────────────────
// Plugin sources — match Claude Code's marketplace.json schema exactly so
// any existing Claude Code marketplace works in MyHub unmodified.
// Reference: https://code.claude.com/docs/en/plugin-marketplaces#plugin-sources
// ──────────────────────────────────────────────────────────────────────────

const githubSourceSchema = z.object({
  source: z.literal('github'),
  repo: z.string().min(1),
  ref: z.string().optional(),
  sha: z.string().optional(),
});

const urlSourceSchema = z.object({
  source: z.literal('url'),
  url: z.string().min(1),
  ref: z.string().optional(),
  sha: z.string().optional(),
});

const gitSubdirSourceSchema = z.object({
  source: z.literal('git-subdir'),
  url: z.string().min(1),
  path: z.string().min(1),
  ref: z.string().optional(),
  sha: z.string().optional(),
});

const npmSourceSchema = z.object({
  source: z.literal('npm'),
  package: z.string().min(1),
  version: z.string().optional(),
  registry: z.string().optional(),
});

const objectSourceSchema = z.discriminatedUnion('source', [
  githubSourceSchema,
  urlSourceSchema,
  gitSubdirSourceSchema,
  npmSourceSchema,
]);

// A source may also be a relative path string starting with "./".
// Per Claude Code docs: paths resolve relative to the marketplace root.
const relativePathSourceSchema = z.string().refine(
  (s) => s.startsWith('./') && !s.includes('..'),
  { message: 'Relative path source must start with "./" and not contain ".."' },
);

const pluginSourceSchema = z.union([objectSourceSchema, relativePathSourceSchema]);

// ──────────────────────────────────────────────────────────────────────────
// Plugin entry — Claude Code allows almost all plugin.json fields here
// (per the Optional plugin fields table in the docs). We accept everything
// permissively so unknown future fields don't break the import.
// ──────────────────────────────────────────────────────────────────────────

const authorSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  url: z.string().url().optional(),
});

// ──────────────────────────────────────────────────────────────────────────
// Connection block — MyHub-specific, plugin-declared.
//
// Drives the Connections-tab "Connect" experience. Lets a plugin declare HOW
// it authenticates and, for static-credential auth (API keys, tokens), WHAT
// fields the user must supply and HOW to obtain them — so the connect modal
// renders friendly labels + instructions instead of raw env-var names.
//
// Backward-compatible: a plugin with no `connection` block falls back to
// transport-derived defaults (http/sse → oauth, stdio-with-${VAR} → api_key
// with field names only). Claude Code ignores the block; it is additive.
//
//   authType "oauth"   — remote MCP server with its own OAuth 2.1 endpoints
//                        AND dynamic client registration (RFC 7591). Connect
//                        launches the popup flow; the client is auto-registered.
//                        `fields` is ignored.
//   authType "oauth_client"
//                      — OAuth 2.1 server that does NOT support dynamic client
//                        registration (e.g. GitHub). Connect opens a field
//                        modal that collects a pre-registered Client ID +
//                        Secret (marked via each field's `role`), then runs
//                        the OAuth popup flow using those credentials instead
//                        of attempting registration. The credentials are
//                        stored per-user; `scopes` pins the OAuth scopes to
//                        request. See the "bring your own client" flow docs.
//   authType "api_key" — static per-user credential(s). Connect opens a field
//                        modal built from `fields` + `instructions`. Values
//                        are stored in the per-user vault and substituted into
//                        the server's stdio `env` or http/sse `headers`
//                        `${VAR}` placeholders at session-build time.
//   authType "none"    — no credentials required (zero-config connect).
// ──────────────────────────────────────────────────────────────────────────

const connectionFieldSchema = z.object({
  /**
   * For `api_key` auth: must match a `${VAR}` placeholder in the plugin's
   * .mcp.json. For `oauth_client` auth: an identifier for the credential
   * (conventionally OAUTH_CLIENT_ID / OAUTH_CLIENT_SECRET).
   */
  name: z
    .string()
    .min(1)
    .regex(
      /^[A-Z][A-Z0-9_]*$/,
      'Field name must be UPPER_SNAKE_CASE to match a ${VAR} placeholder',
    ),
  /** Human label shown next to the input (e.g. "Cliniko API key"). */
  label: z.string().min(1),
  /** Render hint. `password` masks the input. Defaults to `password`. */
  type: z.enum(['password', 'text']).optional(),
  /** Whether the field must be filled. Defaults to true. */
  required: z.boolean().optional(),
  /** Greyed-out example shown inside the empty input. */
  placeholder: z.string().optional(),
  /** Short helper text rendered under the input. */
  helpText: z.string().optional(),
  /**
   * For `oauth_client` auth only: marks which OAuth client credential this
   * field collects, so the connect flow knows which entered value is the
   * client_id and which is the client_secret regardless of field name.
   * Ignored for other auth types.
   */
  role: z.enum(['client_id', 'client_secret']).optional(),
});

const connectionSchema = z.object({
  authType: z.enum(['oauth', 'oauth_client', 'api_key', 'none']),
  /**
   * Markdown shown at the top of the connect modal for api_key / oauth_client
   * auth — tells the user where to obtain the credential. Ignored for
   * oauth/none.
   */
  instructions: z.string().optional(),
  /** "Learn more" link rendered in the connect modal. */
  docUrl: z.string().url().optional(),
  /** Required for api_key / oauth_client auth; the inputs the modal renders. */
  fields: z.array(connectionFieldSchema).optional(),
  /**
   * For `oauth_client` auth: OAuth scopes to request in the authorization
   * request. Lets a plugin pin provider-specific scopes (e.g. GitHub's
   * `repo`, `read:org`) instead of relying on the server's advertised
   * defaults, which often don't apply to non-OIDC providers. Ignored for
   * other auth types.
   */
  scopes: z.array(z.string()).optional(),
  /**
   * For `oauth_client` auth: names of env vars ON THE SERVER (tenant
   * Container App) holding a platform-registered OAuth app's credentials.
   * When both vars are set at runtime, Connect is one-click (no BYOC
   * modal); when unset, the legacy user-supplied Client ID/Secret modal
   * still works. The values themselves never appear in the manifest.
   */
  serverClientEnv: z
    .object({ clientId: z.string().min(1), clientSecret: z.string().min(1) })
    .optional(),
});

export type ConnectionField = z.infer<typeof connectionFieldSchema>;
export type ConnectionSpec = z.infer<typeof connectionSchema>;

// ──────────────────────────────────────────────────────────────────────────
// Content section — MyHub-specific, plugin-declared (plugin packaging spec,
// 2026-07-04). Lists the bundle-relative paths of DB-backed content files
// under content/<kind-dir>/<origin-key>.json. The tenant installer upserts
// each entity by its origin_key; older MyHub versions and Claude Code ignore
// the section entirely (schemas are passthrough).
// ──────────────────────────────────────────────────────────────────────────

const pluginContentSchema = z.object({
  automations: z.array(z.string()).default([]),
  /** Activity templates (the Workspace UI name). The key stays `workqTemplates` because published bundles carry it — content/workq-templates/*.json. */
  workqTemplates: z.array(z.string()).default([]),
  formTemplates: z.array(z.string()).default([]),
  forms: z.array(z.string()).default([]),
  /** Agent blueprints (Digital Twin v2, spec §8) — content/agents/*.json. */
  agents: z.array(z.string()).default([]),
  /** Portable custom Records Engine schemas; never customer rows. */
  recordTypes: z.array(z.string().max(200)).max(20).optional(),
  /** Declarative, nonsecret installation steps. */
  setups: z.array(z.string().max(200)).max(30).optional(),
});

export type PluginContentSection = z.infer<typeof pluginContentSchema>;

/**
 * Optional onboarding hints a plugin may ship (spec 2026-08-19 §2 #7 —
 * "plugin-aware onboarding", the smallest sensible extension point). All
 * optional; absent → mySidekick derives a pitch from `description`. Consumed
 * by the capability resolver (apps/web/src/lib/capabilities/resolver.ts)
 * when it turns an installed plugin / connector into a capability card.
 */
const pluginOnboardingSchema = z.object({
  /** One-line, user-facing "why this matters". */
  pitch: z.string().max(200).optional(),
  /** Concrete first step (imperative). */
  firstStep: z.string().max(120).optional(),
  /** Why connect this (connectors) — shown behind the "Why connect this?" affordance. */
  whyConnect: z.string().max(400).optional(),
  /** Roles/goals this is especially relevant to: everyone | finance | ops | people | sales | admin | it | client-facing | power-user. */
  relevantTo: z.array(z.string().max(30)).max(8).optional(),
  /** Help Center feature area for "Learn more". */
  helpFeatureArea: z.string().max(60).optional(),
});
export type PluginOnboarding = z.infer<typeof pluginOnboardingSchema>;

// ──────────────────────────────────────────────────────────────────────────
// Store branding — Workspace Extensions (spec 2026-09-22). Everything here is
// optional and additive: the 61 registry entries that predate it keep
// validating, and Claude Code ignores both blocks. `icon` stays the fallback
// mark when `branding.logo` is absent.
//
// Asset fields (`logo`, `logoDark`, `screenshots[]`) accept a bundle-relative
// path ("assets/logo.svg"), an https URL, or a data URI. Marketplace sync
// resolves relative paths to data URIs on the stored snapshot so the store
// never fetches from GitHub at render time.
// ──────────────────────────────────────────────────────────────────────────

const assetRefSchema = z.string().min(1).max(200_000);
const hexColorSchema = z.string().regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/, 'Expected a #rgb or #rrggbb colour');

const pluginBrandingSchema = z.object({
  /** Primary mark, SVG preferred. Rendered on a white tile in the store. */
  logo: assetRefSchema.optional(),
  /** Variant for dark surfaces; falls back to `logo`. */
  logoDark: assetRefSchema.optional(),
  /** Accent used as a soft wash behind the detail-page hero. */
  color: hexColorSchema.optional(),
  /** One line under the name on cards and the hero. */
  tagline: z.string().max(90).optional(),
});
export type PluginBranding = z.infer<typeof pluginBrandingSchema>;

const pluginListingSchema = z.object({
  /** Markdown body of the detail page's Overview section. */
  longDescription: z.string().max(20_000).optional(),
  /** Three or four short lines that sell it — rendered as a plain list. */
  highlights: z.array(z.string().max(120)).max(4).optional(),
  screenshots: z.array(assetRefSchema).max(6).optional(),
  /** The organisation behind the extension, distinct from `author` (the maintainer). */
  publisher: z
    .object({
      name: z.string().min(1).max(80),
      url: z.string().url().optional(),
      /** First-party / vetted marker. Set by the registry, never by tenants. */
      verified: z.boolean().optional(),
    })
    .optional(),
  support: z
    .object({
      url: z.string().url().optional(),
      privacyUrl: z.string().url().optional(),
    })
    .optional(),
});
export type PluginListing = z.infer<typeof pluginListingSchema>;

export const marketplacePluginSchema = z
  .object({
    name: z.string().min(1),
    source: pluginSourceSchema,
    description: z.string().optional(),
    version: z.string().optional(),
    author: authorSchema.optional(),
    homepage: z.string().optional(),
    repository: z.string().optional(),
    license: z.string().optional(),
    keywords: z.array(z.string()).optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).optional(),
    strict: z.boolean().optional(),
    icon: z.string().optional(),
    // Component configuration fields — accepted opaquely; consumers parse them.
    commands: z.unknown().optional(),
    agents: z.unknown().optional(),
    skills: z.unknown().optional(),
    hooks: z.unknown().optional(),
    mcpServers: z.unknown().optional(),
    lspServers: z.unknown().optional(),
    // Relative path to compiled widget-elements module (e.g. "widget-elements/dist/index.js").
    widgetElements: z.string().optional(),
    // Relative path to a directory of widget JSON files (e.g. "widgets").
    widgets: z.string().optional(),
    // Relative path to a directory of report templates (e.g. "reports") —
    // one subdirectory per template: `<slug>/report.json` (metadata + data
    // bindings) beside `<slug>/report.html`. Installed templates surface in
    // the workspace Reports library for per-user instantiation; they are
    // portable BECAUSE they carry bindings, not data (technical/reports.md).
    reports: z.string().optional(),
    // Portal extension artifacts — relative paths inside the plugin package.
    // portalWidgets: array of paths to portal widget JSON specs.
    // portalDataMaps: array of paths to portal data-map JSON specs.
    portalWidgets: z.array(z.string()).optional(),
    portalDataMaps: z.array(z.string()).optional(),
    // Briefing extension artifacts — array of paths to email-source JSON specs
    // consumed by the mySidekick morning briefing. Undeclared files are inert.
    briefingEmailSources: z.array(z.string()).optional(),
    // MyHub connection descriptor — drives the Connections-tab connect modal.
    connection: connectionSchema.optional(),
    // MyHub db-backed plugin content — paths to content/<kind>/<origin-key>.json
    // files installed by origin_key upsert. Absent on plugins without content.
    content: pluginContentSchema.optional(),
    // Optional onboarding hints for the adaptive adoption layer (spec 2026-08-19).
    onboarding: pluginOnboardingSchema.optional(),
    // Workspace Extensions store branding + listing copy (spec 2026-09-22).
    branding: pluginBrandingSchema.optional(),
    listing: pluginListingSchema.optional(),
  })
  .passthrough();

// ──────────────────────────────────────────────────────────────────────────
// Marketplace manifest
// ──────────────────────────────────────────────────────────────────────────

const ownerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  url: z.string().url().optional(),
});

const metadataSchema = z
  .object({
    description: z.string().optional(),
    version: z.string().optional(),
    pluginRoot: z.string().optional(),
  })
  .passthrough();

export const marketplaceManifestSchema = z
  .object({
    name: z.string().min(1),
    owner: ownerSchema,
    plugins: z.array(marketplacePluginSchema).min(1),
    metadata: metadataSchema.optional(),
    // Top-level description is non-standard but some marketplaces use it —
    // accept it for compatibility.
    description: z.string().optional(),
  })
  .passthrough();

export type MarketplaceManifest = z.infer<typeof marketplaceManifestSchema>;
export type MarketplacePlugin = z.infer<typeof marketplacePluginSchema>;
export type PluginSource = z.infer<typeof pluginSourceSchema>;

export { connectionSchema };

/**
 * Parse a plugin.json `connection` block. Returns null when the block is
 * absent or malformed — callers fall back to transport-derived defaults, so
 * a bad block degrades to the legacy experience rather than throwing.
 */
export function parseConnectionSpec(data: unknown): ConnectionSpec | null {
  if (data === undefined || data === null) return null;
  const result = connectionSchema.safeParse(data);
  return result.success ? result.data : null;
}

export function validateMarketplaceManifest(
  data: unknown,
): { valid: true; manifest: MarketplaceManifest } | { valid: false; errors: z.ZodError } {
  const result = marketplaceManifestSchema.safeParse(data);
  if (result.success) return { valid: true, manifest: result.data };
  return { valid: false, errors: result.error };
}
