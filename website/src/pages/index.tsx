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
      title="Plugins for the agentic SMB"
      description="Curated agent plugins for SMB-focused business integrations — accounting, CRM, HR, payroll, productivity. The marketplace consumed by MyHub."
    >
      {/* ─── HERO ─── */}
      <section className="hero">
        <div className="hero__inner">
          <div>
            <div className="hero__eyebrow">mySMB · Plugin Marketplace</div>
            <h1 className="hero__title">
              Plug your business in.<br />
              The agent does the&nbsp;<em>rest.</em>
            </h1>
            <p className="hero__lede">
              Curated plugins that wrap business tools — Xero, Zoho, Microsoft
              365, Circle, monday.com — as MCP servers. Same artefact installs
              into a <strong>MyHub</strong> tenant or directly into{' '}
              <strong>Claude Code</strong>.
            </p>
            <div className="hero__cta">
              <Link className="button button--secondary button--lg" to="/intro">
                Get started
              </Link>
              <Link className="button button--outline button--lg" to="/catalog">
                Browse catalog
              </Link>
              <Link
                className="button button--outline button--lg"
                to="/widgets/tutorial-1-first-widget"
              >
                Build a widget
              </Link>
            </div>

            <div className="hero__meta">
              <div className="hero__meta-item">
                <div className="hero__meta-num">{plugins.length}</div>
                <div className="hero__meta-label">Live plugins</div>
              </div>
              <div className="hero__meta-item">
                <div className="hero__meta-num">{categoryCount}</div>
                <div className="hero__meta-label">Categories</div>
              </div>
              <div className="hero__meta-item">
                <div className="hero__meta-num">3</div>
                <div className="hero__meta-label">MCP transports</div>
              </div>
              <div className="hero__meta-item">
                <div className="hero__meta-num">MIT</div>
                <div className="hero__meta-label">Licence</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── WHAT IT IS ─── */}
      <section className="section">
        <div className="section__inner">
          <div className="section__eyebrow">01 / Composition</div>
          <h2 className="section__title">A plugin is five things in one folder.</h2>
          <p className="section__lede">
            Each is optional. Ship only what your integration needs. Everything
            sits inside the standard Claude Code plugin format, so the same
            artefact runs on a developer&apos;s laptop and inside a tenant
            container.
          </p>

          <div className="feature-grid">
            <div className="feature-cell">
              <span className="feature-cell__index">A</span>
              <h3>MCP server</h3>
              <p>
                The tools the LLM actually calls. <code>stdio</code> via npm,
                remote <code>sse</code>/<code>http</code>, or a custom server
                bundled in the repo.
              </p>
            </div>
            <div className="feature-cell">
              <span className="feature-cell__index">B</span>
              <h3>Skills</h3>
              <p>
                Slash-command Markdown files that teach the model how to handle
                one task — &ldquo;create an invoice&rdquo;, &ldquo;find a
                contact&rdquo;.
              </p>
            </div>
            <div className="feature-cell">
              <span className="feature-cell__index">C</span>
              <h3>Agents</h3>
              <p>
                A persona scoped to a domain — billing, CRM, HR. Defines what
                the model does, and crucially what it refuses to do.
              </p>
            </div>
            <div className="feature-cell">
              <span className="feature-cell__index">D</span>
              <h3>Widget elements</h3>
              <p>
                JS helpers — <code>$computed</code> formatters, status-to-tone
                maps, composite components. Slug-namespaced at runtime.
              </p>
            </div>
            <div className="feature-cell">
              <span className="feature-cell__index">E</span>
              <h3>Widgets</h3>
              <p>
                JSON specs that render dashboard tiles in MyHub. Powered by{' '}
                <Link to="https://json-render.vercel.app/">Vercel json-render</Link>
                . The LLM can read, propose, and explain them.
              </p>
            </div>
            <div className="feature-cell">
              <span className="feature-cell__index">+</span>
              <h3>Validator + CI</h3>
              <p>
                One TypeScript script enforces the contract on every PR.
                Plugins that pass are guaranteed to install on every tenant.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── INSTALL STEPS ─── */}
      <section className="section">
        <div className="section__inner">
          <div className="section__eyebrow">02 / Quick start</div>
          <h2 className="section__title">From zero to first widget in ~30 minutes.</h2>

          <div className="steps">
            <div className="step-row">
              <div className="step-num">STEP 01</div>
              <div className="step-body">
                <h3>Install Claude Code or open a MyHub tenant</h3>
                <p>
                  Both consume the same marketplace. Pick whichever surface you
                  ship to.
                </p>
              </div>
            </div>
            <div className="step-row">
              <div className="step-num">STEP 02</div>
              <div className="step-body">
                <h3>Add the marketplace once</h3>
                <p>
                  <code>/plugin marketplace add mySMB-AI-Studio/mysmb-marketplace</code>
                </p>
              </div>
            </div>
            <div className="step-row">
              <div className="step-num">STEP 03</div>
              <div className="step-body">
                <h3>Install plugins on demand</h3>
                <p>
                  <code>/plugin install xero-accounting</code>,{' '}
                  <code>/plugin install zoho-crm</code>, …
                </p>
              </div>
            </div>
            <div className="step-row">
              <div className="step-num">STEP 04</div>
              <div className="step-body">
                <h3>Set the env vars from the README</h3>
                <p>
                  Every plugin documents its credentials under a{' '}
                  <code>## Configuration</code> heading.
                </p>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '3rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <Link className="button button--primary button--lg" to="/authoring/overview">
              Read the authoring guide
            </Link>
            <Link className="button button--outline button--lg" to="/widgets/overview">
              Build a widget →
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}
