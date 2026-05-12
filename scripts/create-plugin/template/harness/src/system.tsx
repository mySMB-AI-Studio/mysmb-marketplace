// Minimal subset of MyHub's widget-system component baseline. Enough for the
// harness to render the starter widget and most simple specs. Full fidelity
// happens in MyHub itself — once you publish, your widget renders against the
// full system.

import React from 'react';

type AnyProps = Record<string, any>;

export const Card = ({ children }: AnyProps) => (
  <div style={{ padding: 16, background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', height: '100%', overflow: 'auto' }}>{children}</div>
);

export const Body = ({ children }: AnyProps) => <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>;
export const Section = ({ children }: AnyProps) => <section style={{ marginTop: 8 }}>{children}</section>;
export const Stack = ({ children, gap = 8 }: AnyProps) => <div style={{ display: 'flex', flexDirection: 'column', gap }}>{children}</div>;
export const Row = ({ children, gap = 8 }: AnyProps) => <div style={{ display: 'flex', flexDirection: 'row', gap, alignItems: 'center' }}>{children}</div>;
export const Grid = ({ children, columns = 2 }: AnyProps) => (
  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 8 }}>{children}</div>
);

export const Header = ({ title, subtitle }: AnyProps) => (
  <div style={{ marginBottom: 8 }}>
    {title ? <div style={{ fontWeight: 600 }}>{title}</div> : null}
    {subtitle ? <div style={{ color: '#6b7280', fontSize: 12 }}>{subtitle}</div> : null}
  </div>
);

export const Heading = ({ text, level = 'h2' }: AnyProps) => {
  const sizes: Record<string, number> = { h1: 22, h2: 18, h3: 16, h4: 14 };
  return <div style={{ fontSize: sizes[level] ?? 18, fontWeight: 600 }}>{String(text ?? '')}</div>;
};

export const Subtitle = ({ text }: AnyProps) => <div style={{ color: '#6b7280', fontSize: 13 }}>{String(text ?? '')}</div>;
export const Eyebrow = ({ text }: AnyProps) => <div style={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 11, color: '#6b7280' }}>{String(text ?? '')}</div>;

export const Text = ({ text, variant }: AnyProps) => (
  <div style={{ color: variant === 'muted' ? '#6b7280' : '#111', fontSize: 14 }}>{String(text ?? '')}</div>
);
export const Caption = ({ text }: AnyProps) => <div style={{ color: '#6b7280', fontSize: 12 }}>{String(text ?? '')}</div>;

export const Stat = ({ label, value, hint }: AnyProps) => (
  <div>
    {label ? <div style={{ color: '#6b7280', fontSize: 12 }}>{String(label)}</div> : null}
    <div style={{ fontSize: 24, fontWeight: 600 }}>{String(value ?? '')}</div>
    {hint ? <div style={{ color: '#6b7280', fontSize: 11 }}>{String(hint)}</div> : null}
  </div>
);

export const Badge = ({ text, tone = 'default' }: AnyProps) => {
  const palette: Record<string, [string, string]> = {
    default: ['#f3f4f6', '#374151'],
    success: ['#dcfce7', '#166534'],
    info: ['#dbeafe', '#1e40af'],
    muted: ['#f3f4f6', '#6b7280'],
    destructive: ['#fee2e2', '#991b1b'],
  };
  const [bg, fg] = palette[tone] ?? palette.default;
  return <span style={{ background: bg, color: fg, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 500 }}>{String(text ?? '')}</span>;
};

export const Dot = ({ tone = 'default' }: AnyProps) => {
  const colors: Record<string, string> = { default: '#9ca3af', success: '#16a34a', info: '#2563eb', destructive: '#dc2626', muted: '#9ca3af' };
  return <span style={{ width: 8, height: 8, borderRadius: 999, display: 'inline-block', background: colors[tone] ?? colors.default }} />;
};

export const Divider = () => <hr style={{ border: 0, borderTop: '1px solid #e5e7eb' }} />;
export const Spinner = () => <span>…</span>;
export const Empty = ({ text = 'No data' }: AnyProps) => <div style={{ color: '#9ca3af', fontSize: 13 }}>{text}</div>;

export const Table = ({ rows, columns }: AnyProps) => {
  const r: any[] = Array.isArray(rows) ? rows : [];
  const c: any[] = Array.isArray(columns) ? columns : [];
  return (
    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
      <thead>
        <tr>{c.map((col) => <th key={col.key} style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid #e5e7eb', color: '#6b7280', fontWeight: 500 }}>{col.label ?? col.key}</th>)}</tr>
      </thead>
      <tbody>
        {r.map((row, i) => (
          <tr key={i}>{c.map((col) => <td key={col.key} style={{ padding: '6px 8px', borderBottom: '1px solid #f3f4f6' }}>{String(row?.[col.key] ?? '')}</td>)}</tr>
        ))}
      </tbody>
    </table>
  );
};

export const ListItem = ({ title, subtitle }: AnyProps) => (
  <div style={{ padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
    <div style={{ fontSize: 13, fontWeight: 500 }}>{String(title ?? '')}</div>
    {subtitle ? <div style={{ color: '#6b7280', fontSize: 12 }}>{String(subtitle)}</div> : null}
  </div>
);

export const KeyValue = ({ label, value }: AnyProps) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
    <span style={{ color: '#6b7280' }}>{String(label ?? '')}</span>
    <span>{String(value ?? '')}</span>
  </div>
);

export const Button = ({ text, onClick }: AnyProps) => (
  <button onClick={onClick} style={{ background: '#111', color: 'white', border: 0, borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer' }}>{String(text ?? '')}</button>
);

export const components = {
  Card, Body, Section, Stack, Row, Grid, Header, Heading, Subtitle, Eyebrow,
  Text, Caption, Stat, Badge, Dot, Divider, Spinner, Empty, Table, ListItem,
  KeyValue, Button,
};

// Generic $computed helpers. Expand as needed; full system catalog lives in MyHub.
export const functions: Record<string, (args: Record<string, any>) => unknown> = {
  identity: (a) => a.value,
  count: (a) => (Array.isArray(a.value) ? a.value.length : 0),
  sum: (a) => (Array.isArray(a.value) ? a.value.reduce((acc: number, v: any) => acc + (Number(v) || 0), 0) : 0),
  format_currency: (a) => {
    const n = Number(a.value);
    if (!Number.isFinite(n)) return '';
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: a.currency || 'USD' }).format(n);
  },
  format_date: (a) => {
    const d = new Date(String(a.value));
    return Number.isFinite(d.getTime()) ? d.toLocaleDateString() : String(a.value ?? '');
  },
  fmt: (a) => String(a.value ?? ''),
};
