import React from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import marketplace from '../../../.claude-plugin/marketplace.json';

type Plugin = { name: string; category?: string };

export default function Home(): JSX.Element {
  const plugins = (marketplace as { plugins: Plugin[] }).plugins;
  const categoryCount = new Set(plugins.map((p) => p.category).filter(Boolean)).size;

  return (
    <Layout
      title="mySMB Marketplace — developer documentation"
      description="Build and publish agent plugins for MyHub and Claude Code. Specs, tutorials, and reference."
    >
      <main className="landing">
        {/* ── Intro ── */}
        <div className="landing__intro">
          <div className="landing__eyebrow">v0.1 · {plugins.length} plugins · {categoryCount} categories</div>
          <h1 className="landing__title">mySMB Marketplace</h1>
          <p className="landing__lede">
            A registry of agent plugins for SMB integrations — accounting, CRM,
            HR, payroll, productivity. Each plugin wraps a business tool as a{' '}
            <Link to="https://modelcontextprotocol.io/">Model Context Protocol</Link>{' '}
            server. The same artefact installs into{' '}
            <Link to="https://github.com/mySMB-AI-Studio/myHubV2">MyHub</Link>{' '}
            tenants and into Claude Code.
          </p>
          <div className="landing__cta">
            <Link className="button button--primary" to="/intro">
              Get started
            </Link>
            <Link className="button button--secondary" to="/authoring/overview">
              Authoring guide
            </Link>
            <Link className="button button--secondary" to="/catalog">
              Plugin catalog
            </Link>
          </div>
        </div>

        {/* ── Quick install ── */}
        <section className="landing__section">
          <h2>Install a plugin</h2>
          <p className="landing__section-lede">
            Add the marketplace once, then install plugins by name. Each
            plugin&apos;s README documents its required environment variables.
          </p>
          <pre className="code-snippet">
            <code>
              <span className="prompt">$</span>/plugin marketplace add mySMB-AI-Studio/mysmb-marketplace{'\n'}
              <span className="prompt">$</span>/plugin install xero-accounting
            </code>
          </pre>
        </section>

        {/* ── Where to start ── */}
        <section className="landing__section">
          <h2>Documentation</h2>
          <p className="landing__section-lede">
            Pick the entry point that matches what you&apos;re trying to do.
          </p>

          <div className="nav-grid">
            <Link className="nav-card" to="/intro">
              <div className="nav-card__label">Section · Get started</div>
              <div className="nav-card__title">Install &amp; first run</div>
              <p className="nav-card__desc">
                What this marketplace is, who uses it, how to install a plugin
                in Claude Code or browse the MyHub catalog.
              </p>
            </Link>

            <Link className="nav-card" to="/authoring/overview">
              <div className="nav-card__label">Section · Authoring</div>
              <div className="nav-card__title">Build a plugin</div>
              <p className="nav-card__desc">
                Six-chapter walkthrough — MCP server, skills, agents, widget
                elements, validate &amp; ship. Copy-pasteable examples
                throughout.
              </p>
            </Link>

            <Link className="nav-card" to="/widgets/overview">
              <div className="nav-card__label">Section · Widgets</div>
              <div className="nav-card__title">Author dashboard widgets</div>
              <p className="nav-card__desc">
                Four hands-on tutorials, full spec-primitive reference, and a
                components catalog. Powered by Vercel json-render.
              </p>
            </Link>

            <Link className="nav-card" to="/reference/plugin-json">
              <div className="nav-card__label">Section · Reference</div>
              <div className="nav-card__title">File formats</div>
              <p className="nav-card__desc">
                Field-by-field reference for <code>plugin.json</code>,{' '}
                <code>.mcp.json</code>, widget JSON, and validator rules.
              </p>
            </Link>

            <Link className="nav-card" to="/catalog">
              <div className="nav-card__label">Section · Catalog</div>
              <div className="nav-card__title">Browse plugins</div>
              <p className="nav-card__desc">
                Every plugin currently shipping. Filterable by category, with
                links to source on GitHub.
              </p>
            </Link>

            <Link
              className="nav-card"
              to="https://json-render.vercel.app/"
            >
              <div className="nav-card__label">External · Renderer</div>
              <div className="nav-card__title">Vercel json-render</div>
              <p className="nav-card__desc">
                The underlying schema MyHub widgets compile to. Reference for
                primitive semantics and edge cases.
              </p>
            </Link>
          </div>
        </section>
      </main>
    </Layout>
  );
}
