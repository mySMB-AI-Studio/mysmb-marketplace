// Fallback system components — used when MyHub source isn't on disk.
//
// @json-render/react's defineRegistry calls each component as
//   componentFn({ props, children, bindings, emit, on, loading })
// Components MUST destructure from props/bindings — not top-level keys.
//
// This module mirrors the prop shape and component names used by MyHub's
// widgets-system, so widgets continue to render (just with a plain, system-
// font look) even without the real MyHub primitives. To get full fidelity,
// point HARNESS_MYHUB_PATH at your myHubV2 checkout — see vite.config.ts.

import React from 'react';

type ComponentArgs = {
  props?: Record<string, any>;
  bindings?: Record<string, any>;
  children?: React.ReactNode;
  emit?: (event: string, payload?: unknown) => void;
};
const p = (a: ComponentArgs) => ({ ...(a.props ?? {}), ...(a.bindings ?? {}) });

const GAPS: Record<string, number> = { none: 0, xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
const toGap = (g: unknown) =>
  typeof g === 'number' ? g : typeof g === 'string' ? GAPS[g] ?? g : 8;

export const Card = (a: ComponentArgs) => (
  <div className="relative flex h-full w-full flex-col gap-3 p-4">{a.children}</div>
);
export const Header = (a: ComponentArgs) => <div className="flex flex-col gap-0.5">{a.children}</div>;
export const Body = (a: ComponentArgs) => <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{a.children}</div>;
export const Section = (a: ComponentArgs) => <section className="mt-2">{a.children}</section>;
export const Stack = (a: ComponentArgs) => {
  const { gap, grow } = p(a);
  return <div style={{ display: 'flex', flexDirection: 'column', gap: toGap(gap), flex: grow ? 1 : undefined, minWidth: 0 }}>{a.children}</div>;
};
export const Row = (a: ComponentArgs) => {
  const { gap, align = 'center', justify, grow } = p(a);
  return <div style={{ display: 'flex', gap: toGap(gap), alignItems: align, justifyContent: justify, flex: grow ? 1 : undefined, minWidth: 0 }}>{a.children}</div>;
};
export const Grid = (a: ComponentArgs) => {
  const { columns, cols, gap } = p(a);
  const numCols = Number(columns ?? cols ?? 2);
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${numCols}, 1fr)`, gap: toGap(gap) }}>{a.children}</div>;
};
export const FormRow = (a: ComponentArgs) => {
  const { label } = p(a);
  return (
    <div className="flex flex-col gap-1">
      {label ? <div className="text-[11px] font-medium text-gray-500">{String(label)}</div> : null}
      {a.children}
    </div>
  );
};

export const Heading = (a: ComponentArgs) => {
  const { text, level = 'h2' } = p(a);
  const sizes: Record<string, string> = { h1: 'text-[22px]', h2: 'text-lg', h3: 'text-base', h4: 'text-sm' };
  return <div className={`${sizes[level] ?? 'text-lg'} font-semibold`}>{String(text ?? '')}</div>;
};
export const Subtitle = (a: ComponentArgs) => <div className="text-sm text-gray-500">{String(p(a).text ?? '')}</div>;
export const Eyebrow = (a: ComponentArgs) => <div className="text-[11px] uppercase tracking-wide text-gray-500">{String(p(a).text ?? '')}</div>;
export const Text = (a: ComponentArgs) => {
  const { text, tone, weight, size, truncate } = p(a);
  const sizes: Record<string, string> = { xs: 'text-[10px]', sm: 'text-xs', md: 'text-sm', lg: 'text-base', xl: 'text-lg' };
  const weights: Record<string, string> = { medium: 'font-medium', semibold: 'font-semibold', bold: 'font-bold' };
  const tones: Record<string, string> = { muted: 'text-gray-500', subtle: 'text-gray-400', success: 'text-emerald-600', destructive: 'text-red-600' };
  return <div className={`${sizes[size] ?? 'text-sm'} ${weights[weight] ?? ''} ${tones[tone] ?? 'text-gray-900'} ${truncate ? 'truncate' : ''}`}>{String(text ?? '')}</div>;
};
export const Caption = (a: ComponentArgs) => <div className="text-xs text-gray-500">{String(p(a).text ?? '')}</div>;
export const RichHtml = (a: ComponentArgs) => <div className="text-sm" dangerouslySetInnerHTML={{ __html: String(p(a).html ?? '') }} />;

export const Stat = (a: ComponentArgs) => {
  const { label, value, hint } = p(a);
  return (
    <div>
      {label && <div className="text-xs text-gray-500">{String(label)}</div>}
      <div className="text-2xl font-semibold">{String(value ?? '')}</div>
      {hint && <div className="text-[11px] text-gray-500">{String(hint)}</div>}
    </div>
  );
};

const BADGE_TONES: Record<string, string> = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-emerald-100 text-emerald-700',
  info: 'bg-blue-100 text-blue-700',
  muted: 'bg-gray-100 text-gray-500',
  destructive: 'bg-red-100 text-red-700',
  warning: 'bg-amber-100 text-amber-800',
  accent: 'bg-violet-100 text-violet-700',
};
export const Badge = (a: ComponentArgs) => {
  const { text, label, tone = 'default' } = p(a);
  return <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${BADGE_TONES[tone] ?? BADGE_TONES.default}`}>{String(text ?? label ?? '')}</span>;
};
export const Dot = (a: ComponentArgs) => {
  const { tone = 'default' } = p(a);
  const colors: Record<string, string> = { default: 'bg-gray-400', success: 'bg-emerald-500', info: 'bg-blue-500', destructive: 'bg-red-500', warning: 'bg-amber-500' };
  return <span className={`inline-block h-2 w-2 rounded-full ${colors[tone] ?? colors.default}`} />;
};
export const ProgressBar = (a: ComponentArgs) => {
  const { value = 0, max = 100 } = p(a);
  const pct = Math.max(0, Math.min(100, (Number(value) / Number(max || 1)) * 100));
  return <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100"><div className="h-full bg-blue-500" style={{ width: `${pct}%` }} /></div>;
};
export const Delta = (a: ComponentArgs) => {
  const { value } = p(a);
  const n = Number(value);
  const sign = n > 0 ? '+' : '';
  const color = n > 0 ? 'text-emerald-600' : n < 0 ? 'text-red-600' : 'text-gray-500';
  return <span className={`font-mono text-xs ${color}`}>{Number.isFinite(n) ? `${sign}${n}` : ''}</span>;
};
export const Avatar = (a: ComponentArgs) => {
  const { name = '?', src, size = 'md' } = p(a);
  const sizes: Record<string, number> = { sm: 20, md: 28, lg: 36, xl: 48 };
  const px = sizes[size] ?? 28;
  if (src) return <img src={String(src)} alt={String(name)} style={{ width: px, height: px }} className="rounded-full object-cover" />;
  return <span style={{ width: px, height: px }} className="inline-flex items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-700">{String(name).charAt(0).toUpperCase()}</span>;
};
export const Icon = (a: ComponentArgs) => {
  const { name = '?', size = 'md' } = p(a);
  const sizes: Record<string, number> = { xs: 10, sm: 12, md: 14, lg: 18, xl: 22 };
  const px = sizes[size] ?? 14;
  return <span title={String(name)} style={{ width: px + 4, height: px + 4, fontSize: Math.max(px - 4, 8) }} className="inline-flex items-center justify-center rounded border border-current font-semibold leading-none text-gray-600">{String(name).charAt(0).toUpperCase()}</span>;
};

export const Divider = () => <hr className="border-0 border-t border-gray-200" />;
export const Spinner = () => <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-gray-200 border-t-blue-500" />;
export const Skeleton = (a: ComponentArgs) => {
  const { height = '1rem', width = '100%' } = p(a);
  return <div style={{ height, width }} className="animate-pulse rounded bg-gray-100" />;
};
export const Empty = (a: ComponentArgs) => <div className="text-sm text-gray-400">{String(p(a).text ?? p(a).message ?? 'No data')}</div>;

export const Table = (a: ComponentArgs) => {
  const { rows, columns } = p(a);
  const r: any[] = Array.isArray(rows) ? rows : [];
  const c: any[] = Array.isArray(columns) ? columns : [];
  return (
    <table className="w-full border-collapse text-xs">
      <thead><tr>{c.map((col) => <th key={col.key} className="border-b border-gray-200 px-2 py-1.5 text-left font-medium text-gray-500">{col.label ?? col.key}</th>)}</tr></thead>
      <tbody>{r.map((row, i) => <tr key={i}>{c.map((col) => <td key={col.key} className="border-b border-gray-100 px-2 py-1.5">{String(row?.[col.key] ?? '')}</td>)}</tr>)}</tbody>
    </table>
  );
};
export const ListItem = (a: ComponentArgs) => {
  const { title, subtitle } = p(a);
  return (
    <div className="border-b border-gray-100 py-2">
      <div className="text-sm font-medium">{String(title ?? '')}</div>
      {subtitle && <div className="text-xs text-gray-500">{String(subtitle)}</div>}
      {a.children}
    </div>
  );
};
export const ActivityItem = (a: ComponentArgs) => {
  const { title, subtitle, time } = p(a);
  return (
    <div className="flex items-start gap-2 py-1.5">
      <span className="mt-1.5 inline-block h-1.5 w-1.5 rounded-full bg-gray-400" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{String(title ?? '')}</div>
        {subtitle && <div className="text-xs text-gray-500">{String(subtitle)}</div>}
      </div>
      {time && <div className="text-[11px] text-gray-400">{String(time)}</div>}
    </div>
  );
};
export const KeyValue = (a: ComponentArgs) => {
  const { label, value } = p(a);
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-gray-500">{String(label ?? '')}</span>
      <span className="text-sm font-medium">{String(value ?? '')}</span>
    </div>
  );
};

export const BarChart = (a: ComponentArgs) => {
  const { data = [], labelField = 'label', valueField = 'value', valueFormat, tone = 'default' } = p(a);
  const items: any[] = Array.isArray(data) ? data : [];
  const max = Math.max(...items.map((d) => Number(d[valueField] ?? 0)), 1);
  const fmtVal = (n: number) =>
    valueFormat === 'currency'
      ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(n)
      : String(n);
  const TONE_COLORS: Record<string, string> = {
    default: '#6B7280', accent: '#34DFBA', success: '#10B981', warning: '#F59E0B', destructive: '#DC2626', info: '#34DFBA',
  };
  const barColor = TONE_COLORS[tone] ?? TONE_COLORS.default;
  return (
    <div className="flex flex-col gap-2 py-1">
      {items.map((d, i) => {
        const val = Number(d[valueField] ?? 0);
        const pct = max > 0 ? (val / max) * 100 : 0;
        return (
          <div key={i} className="flex items-center gap-2 text-[11px]">
            <span className="w-24 shrink-0 truncate text-gray-500">{String(d[labelField] ?? '')}</span>
            <div className="flex flex-1 items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
              </div>
              <span className="w-16 shrink-0 text-right font-medium text-gray-700">{fmtVal(val)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const Sparkline = (a: ComponentArgs) => {
  const { values = [], tone = 'default', height = 48, fill = false } = p(a);
  const pts: number[] = Array.isArray(values) ? values.map(Number) : [];
  if (pts.length < 2) return <div style={{ height }} />;
  const min = Math.min(...pts), max = Math.max(...pts), range = max - min || 1;
  const w = 300, h = Number(height);
  const pad = 2;
  const xs = pts.map((_, i) => pad + (i / (pts.length - 1)) * (w - pad * 2));
  const ys = pts.map((v) => pad + (1 - (v - min) / range) * (h - pad * 2));
  const polyline = xs.map((x, i) => `${x},${ys[i]}`).join(' ');
  const fillPath = `M ${xs[0]},${ys[0]} ${xs.map((x, i) => `L ${x},${ys[i]}`).join(' ')} L ${xs[xs.length - 1]},${h} L ${xs[0]},${h} Z`;
  const TONE_COLORS: Record<string, string> = { default: '#6B7280', accent: '#34DFBA', success: '#10B981', warning: '#F59E0B', destructive: '#DC2626' };
  const color = TONE_COLORS[tone] ?? TONE_COLORS.default;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height }} preserveAspectRatio="none">
      {fill && <path d={fillPath} fill={color} fillOpacity={0.15} />}
      <polyline points={polyline} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export const Button = (a: ComponentArgs) => {
  const { text, label, disabled } = p(a);
  return <button disabled={!!disabled} onClick={() => a.emit?.('click')} className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">{String(text ?? label ?? '')}</button>;
};
export const IconButton = (a: ComponentArgs) => {
  const { name = '?' } = p(a);
  return <button onClick={() => a.emit?.('click')} className="inline-flex items-center justify-center rounded border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50">{String(name).charAt(0).toUpperCase()}</button>;
};
export const TextInput = (a: ComponentArgs) => {
  const { placeholder, value = '' } = p(a);
  return <input type="text" placeholder={placeholder} defaultValue={String(value ?? '')} onChange={(e) => a.emit?.('change', e.target.value)} className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />;
};
export const NumberInput = (a: ComponentArgs) => {
  const { placeholder, value = '' } = p(a);
  return <input type="number" placeholder={placeholder} defaultValue={String(value ?? '')} onChange={(e) => a.emit?.('change', e.target.value)} className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />;
};
export const DateInput = (a: ComponentArgs) => {
  const { value = '' } = p(a);
  return <input type="date" defaultValue={String(value ?? '')} onChange={(e) => a.emit?.('change', e.target.value)} className="w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm" />;
};
export const Select = (a: ComponentArgs) => {
  const { value, options = [] } = p(a);
  const opts: any[] = Array.isArray(options) ? options : [];
  return (
    <select defaultValue={value ?? ''} onChange={(e) => a.emit?.('change', e.target.value)} className="rounded-md border border-gray-200 px-2 py-1.5 text-sm">
      {opts.map((o) => <option key={String(o.value ?? o)} value={String(o.value ?? o)}>{String(o.label ?? o.value ?? o)}</option>)}
    </select>
  );
};
export const Checkbox = (a: ComponentArgs) => {
  const { label, checked } = p(a);
  return (
    <label className="inline-flex items-center gap-1.5 text-sm">
      <input type="checkbox" defaultChecked={!!checked} onChange={(e) => a.emit?.('change', e.target.checked)} />
      {label && String(label)}
    </label>
  );
};

export const Overlay = (a: ComponentArgs) => {
  const { open = true } = p(a);
  if (!open) return null;
  return <div className="mt-2 rounded-md border border-dashed border-gray-300 bg-gray-50 p-3">{a.children}</div>;
};
export const OverlayClose = (a: ComponentArgs) => (
  <button onClick={() => a.emit?.('click')} className="bg-transparent text-base text-gray-500">×</button>
);
