import React, { useMemo, useState } from 'react';
import Link from '@docusaurus/Link';
import marketplace from '../../../.claude-plugin/marketplace.json';

type Plugin = {
  name: string;
  displayName?: string;
  description: string;
  category?: string;
  version?: string;
  tags?: string[];
  source?: string | { path?: string; source?: string };
};

function pluginPath(p: Plugin): string {
  if (typeof p.source === 'string') return p.source.replace(/^\.\//, '');
  if (p.source?.path) return p.source.path;
  if (p.source?.source) return p.source.source.replace(/^\.\//, '');
  return `plugins/${p.name}`;
}

export default function PluginCatalog(): JSX.Element {
  const plugins = (marketplace as { plugins: Plugin[] }).plugins;

  const categories = useMemo(() => {
    const set = new Set<string>();
    plugins.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ['all', ...Array.from(set).sort()];
  }, [plugins]);

  const [activeCategory, setActiveCategory] = useState<string>('all');

  const visible = useMemo(() => {
    if (activeCategory === 'all') return plugins;
    return plugins.filter((p) => p.category === activeCategory);
  }, [activeCategory, plugins]);

  return (
    <>
      <div className="catalog-toolbar">
        <span className="catalog-toolbar__count">
          {String(visible.length).padStart(2, '0')} / {String(plugins.length).padStart(2, '0')}
        </span>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`catalog-filter-button${
              activeCategory === cat ? ' active' : ''
            }`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="catalog-grid">
        {visible.map((p) => {
          const path = pluginPath(p);
          const ghUrl = `https://github.com/mySMB-AI-Studio/mysmb-marketplace/tree/main/${path}`;
          return (
            <Link key={p.name} to={ghUrl} className="catalog-card">
              <div className="catalog-card__head">
                {p.category && (
                  <span className="catalog-card__category">{p.category}</span>
                )}
                {p.version && (
                  <span className="catalog-card__version">v{p.version}</span>
                )}
              </div>
              <h3 className="catalog-card__title">{p.displayName || p.name}</h3>
              <p className="catalog-card__desc">{p.description}</p>
              {p.tags && p.tags.length > 0 && (
                <div className="catalog-card__tags">
                  {p.tags.slice(0, 4).map((t) => (
                    <span key={t} className="catalog-card__tag">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <span className="catalog-card__cta">View on GitHub</span>
            </Link>
          );
        })}
      </div>

      <p className="catalog-source">
        Source of truth:{' '}
        <Link to="https://github.com/mySMB-AI-Studio/mysmb-marketplace/blob/main/.claude-plugin/marketplace.json">
          <code>.claude-plugin/marketplace.json</code>
        </Link>
      </p>
    </>
  );
}
