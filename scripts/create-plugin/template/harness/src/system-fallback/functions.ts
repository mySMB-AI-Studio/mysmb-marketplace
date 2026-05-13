// Fallback $computed helpers — used when MyHub source isn't on disk. Mirrors
// the keys MyHub's `widgetFunctions` exports so widgets that lean on the
// system catalog continue to resolve. Plugin-namespaced helpers
// (`<slug>_<name>`) still flow through plugin/widget-elements/dist/index.js.

const parseDate = (v: unknown): Date | null => {
  if (v == null || v === '') return null;
  const d = new Date(String(v));
  return Number.isFinite(d.getTime()) ? d : null;
};

export const widgetFunctions: Record<string, (a: any) => unknown> = {
  identity: (a) => a.value,
  count: (a) => (Array.isArray(a.value) ? a.value.length : 0),
  sum: (a) => (Array.isArray(a.value) ? a.value.reduce((acc: number, v: any) => acc + (Number(v) || 0), 0) : 0),
  first: (a) => (Array.isArray(a.value) ? a.value[0] : undefined),
  last: (a) => (Array.isArray(a.value) ? a.value[a.value.length - 1] : undefined),
  not: (a) => !a.value,
  is_empty: (a) => !a.value || (Array.isArray(a.value) && a.value.length === 0),
  is_truthy: (a) => Boolean(a.value),
  format_currency: (a) => {
    const n = Number(a.value);
    if (!Number.isFinite(n)) return '';
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: a.currency || 'USD' }).format(n);
  },
  format_number: (a) => {
    const n = Number(a.value);
    return Number.isFinite(n) ? new Intl.NumberFormat().format(n) : '';
  },
  format_date: (a) => {
    const d = parseDate(a.value);
    if (!d) return String(a.value ?? '');
    if (a.format === 'long') return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    return d.toLocaleDateString();
  },
  format_time: (a) => {
    const d = parseDate(a.value);
    return d ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : String(a.value ?? '');
  },
  duration_between: (a) => {
    const s = parseDate(a.start);
    const e = parseDate(a.end);
    if (!s || !e) return '';
    const mins = Math.max(0, Math.round((e.getTime() - s.getTime()) / 60000));
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  },
  relative_time: (a) => {
    const d = parseDate(a.value);
    if (!d) return '';
    const diff = d.getTime() - Date.now();
    const abs = Math.abs(diff);
    const mins = Math.round(abs / 60000);
    const future = diff > 0;
    if (mins < 1) return 'now';
    if (mins < 60) return future ? `in ${mins}m` : `${mins}m ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return future ? `in ${hours}h` : `${hours}h ago`;
    const days = Math.round(hours / 24);
    return future ? `in ${days}d` : `${days}d ago`;
  },
  filter_date_range: (a) => {
    const arr = Array.isArray(a.value) ? a.value : [];
    if (arr.length === 0) return arr;
    const start = parseDate(a.start) ?? new Date(new Date().setHours(0, 0, 0, 0));
    const end = parseDate(a.end) ?? new Date(new Date().setHours(23, 59, 59, 999));
    const field = String(a.field ?? '');
    const get = (item: any) => {
      if (!field) return item;
      const parts = field.split(/[./]/);
      let v: any = item;
      for (const part of parts) v = v?.[part];
      return v;
    };
    return arr.filter((item: any) => {
      const d = parseDate(get(item));
      return d && d >= start && d <= end;
    });
  },
  fmt: (a) => {
    if (typeof a.pattern === 'string') {
      return a.pattern.replace(/\{(\w+)\}/g, (_: string, k: string) => {
        const v = a[k];
        return v == null ? '' : String(v);
      });
    }
    return String(a.value ?? '');
  },
};

export const cellFormatters: Record<string, (a: any) => unknown> = {};
export const cellToneFormatters: Record<string, (a: any) => unknown> = {};
