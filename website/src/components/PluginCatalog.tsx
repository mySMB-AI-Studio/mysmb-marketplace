import React, { useMemo, useState } from 'react';
import Link from '@docusaurus/Link';
import marketplace from '../../../.claude-plugin/marketplace.json';

type Plugin = {
  name: string;
  displayName?: string;
  description: string;
  category?: string;
  version?: string;
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
          {visible.length} of {plugins.length}
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

      <div className="catalog-table">
        <div className="catalog-row catalog-row--head">
          <span>Plugin</span>
          <span>Category</span>
          <span>Description</span>
          <span></span>
        </div>
        {visible.map((p) => {
          const path = pluginPath(p);
          const ghUrl = `https://github.com/mySMB-AI-Studio/mysmb-marketplace/tree/main/${path}`;
          return (
            <Link key={p.name} to={ghUrl} className="catalog-row">
              <span className="catalog-row__name">{p.displayName || p.name}</span>
              <span className="catalog-row__category">{p.category || '—'}</span>
              <span className="catalog-row__desc">{p.description}</span>
              <span className="catalog-row__cta">View →</span>
            </Link>
          );
        })}
      </div>

      <p style={{ fontSize: '0.85rem', color: 'var(--ink-500)' }}>
        Source of truth:{' '}
        <Link to="https://github.com/mySMB-AI-Studio/mysmb-marketplace/blob/main/.claude-plugin/marketplace.json">
          <code>.claude-plugin/marketplace.json</code>
        </Link>
      </p>
    </>
  );
}
