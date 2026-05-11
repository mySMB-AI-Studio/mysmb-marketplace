import React from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';

export default function Home(): JSX.Element {
  return (
    <Layout
      title="mySMB Marketplace"
      description="Curated agent plugins for SMB-focused business integrations"
    >
      <header className="hero-banner">
        <div className="container">
          <h1>mySMB Marketplace</h1>
          <p>
            Curated agent plugins for SMB-focused business integrations —
            accounting, CRM, HR, payroll, productivity. One install, two
            homes: MyHub tenants and Claude Code.
          </p>
          <div className="hero-buttons">
            <Link className="button button--secondary button--lg" to="/intro">
              Get started
            </Link>
            <Link className="button button--outline button--lg" to="/catalog">
              Browse plugins
            </Link>
            <Link
              className="button button--outline button--lg"
              to="/widgets/tutorial-1-first-widget"
            >
              Build a widget
            </Link>
          </div>
        </div>
      </header>

      <main className="container">
        <div className="feature-row">
          <div className="feature-card">
            <h3>📦 Standard Claude Code plugin format</h3>
            <p>
              Same artefact installs into MyHub tenants or directly into
              Claude Code. No custom packaging, no drift.
            </p>
          </div>
          <div className="feature-card">
            <h3>🔌 Any MCP transport</h3>
            <p>
              <code>stdio</code> via npm, remote <code>sse</code> /{' '}
              <code>http</code>, or a custom server bundled in the repo.
              Pick whatever upstream ships.
            </p>
          </div>
          <div className="feature-card">
            <h3>🎨 Declarative widgets</h3>
            <p>
              Build dashboard tiles in JSON — powered by{' '}
              <Link to="https://json-render.vercel.app/">
                Vercel json-render
              </Link>
              . The LLM can read, propose, and explain them.
            </p>
          </div>
          <div className="feature-card">
            <h3>🔐 Env-var credentials, pure Node</h3>
            <p>
              No hardcoded secrets, no native binaries, no platform-specific
              code. Same build runs everywhere.
            </p>
          </div>
        </div>

        <div style={{ padding: '2rem 0', textAlign: 'center' }}>
          <h2>Ship a plugin in an hour</h2>
          <p style={{ maxWidth: 720, margin: '0 auto 1.5rem' }}>
            The authoring guide walks you from empty folder to merged PR,
            chapter by chapter — MCP server, skills, agents, widget elements,
            widgets. Every chapter has copy-pasteable examples.
          </p>
          <Link className="button button--primary button--lg" to="/authoring/overview">
            Start the authoring guide →
          </Link>
        </div>
      </main>
    </Layout>
  );
}
