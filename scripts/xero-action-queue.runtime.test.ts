// @vitest-environment jsdom
//
// Xero Action Queue in the real widget runtime: the shipped
// plugins/xero-accounting/widgets/xero-action-queue.json spec rendered by
// @json-render/react 0.16.0 on React 19.2.4 (the versions pinned in myHubV2's
// lockfile) with the BUILT xero-accounting widget-elements module. The host is
// simulated the way myHubV2 does it: the dataProvider result and every
// `<mcp>.<tool>` action write one state path per top-level key of the result
// (widgets-system/call-tool.ts resultToStateWrites), set /_loading and reset
// /_errors around each call (widgets-system/registry.ts). Synthetic data only.
//
// Components are DOM stubs; the host's own components are tested in myHubV2.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement as h, act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createStateStore, type StateStore } from '@json-render/core';
import { JSONUIProvider, Renderer } from '@json-render/react';
import { afterEach, describe, expect, it } from 'vitest';
import elements from '../plugins/xero-accounting/widget-elements/dist/index.js';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

const MCP = 'xero-accounting';
const widget = JSON.parse(
  readFileSync(join(process.cwd(), 'plugins/xero-accounting/widgets/xero-action-queue.json'), 'utf8'),
);

const spec = structuredClone(widget.spec);
for (const [key, el] of Object.entries(spec.elements as Record<string, { props?: Record<string, unknown> }>)) {
  el.props = { ...(el.props ?? {}), __key: key };
}

function Stub({ element, children, emit }: { element: { type: string; props: Record<string, unknown> }; children?: ReactNode; emit: (e: string) => void }) {
  const p = element.props ?? {};
  const key = p.__key as string;
  const text = typeof p.label === 'string' ? p.label : p.text == null ? '' : String(p.text);
  switch (element.type) {
    case 'Button':
      return h('button', { type: 'button', 'data-key': key, onClick: () => emit('click') }, text);
    case 'Row':
      return h('div', { 'data-key': key, ...(p.clickable ? { role: 'button', onClick: () => emit('click') } : {}) }, children);
    case 'Text':
    case 'Caption':
    case 'Heading':
    case 'Badge':
      return h('span', { 'data-key': key, 'data-tone': String(p.tone ?? '') }, text);
    default:
      return h('div', { 'data-key': key, 'data-type': element.type }, children);
  }
}

// ── synthetic Xero organisation ──────────────────────────────────────
const BANK = 'acc-bank-1';
const SAVINGS = 'acc-bank-2';
const CLEARING = 'acc-clearing';

const XERO: Record<string, unknown> = {
  list_invoices: {
    Invoices: [{ Type: 'ACCREC' }, { Type: 'ACCREC' }, { Type: 'ACCPAY' }],
  },
  list_bank_transactions: {
    BankTransactions: [
      { Type: 'SPEND', IsReconciled: false, Status: 'AUTHORISED', BankAccount: { AccountID: BANK } },
      { Type: 'RECEIVE', IsReconciled: false, Status: 'AUTHORISED', BankAccount: { AccountID: SAVINGS } },
      { Type: 'SPEND-TRANSFER', IsReconciled: false, Status: 'AUTHORISED', BankAccount: { AccountID: BANK } },
    ],
  },
  list_payments: {
    Payments: [
      { IsReconciled: false, Status: 'AUTHORISED', Account: { AccountID: BANK } },
      { IsReconciled: false, Status: 'AUTHORISED', Account: { AccountID: BANK }, BatchPaymentID: 'batch-1' },
      { IsReconciled: false, Status: 'AUTHORISED', Account: { AccountID: BANK }, BatchPaymentID: 'batch-1' },
      { IsReconciled: false, Status: 'AUTHORISED', Account: { AccountID: SAVINGS }, BatchPayment: { BatchPaymentID: 'batch-2' } },
      { IsReconciled: false, Status: 'AUTHORISED', Account: { AccountID: CLEARING } },
    ],
  },
  list_accounts: {
    Accounts: [
      { AccountID: BANK, Type: 'BANK', Name: 'Business Account' },
      { AccountID: SAVINGS, Type: 'BANK', Name: 'Business Savings' },
    ],
  },
  list_expense_claims: { ExpenseClaims: [{ Status: 'SUBMITTED' }] },
  get_organisation: { Organisations: [{ Name: 'Demo Company (AU)', ShortCode: '!aB3cD' }] },
};

const deepLink = (path: string) =>
  `https://go.xero.com/organisationlogin/default.aspx?shortcode=!aB3cD&redirecturl=${encodeURIComponent(path)}`;

// ── harness ──────────────────────────────────────────────────────────
interface Tile {
  store: StateStore;
  container: HTMLElement;
  calls: Array<{ tool: string; params: Record<string, unknown> }>;
  opened: string[];
}

const mounted: Root[] = [];

afterEach(async () => {
  for (const root of mounted.splice(0)) await act(async () => root.unmount());
  document.body.innerHTML = '';
});

function specActions(): string[] {
  const found = new Set<string>();
  const walk = (n: unknown) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!n || typeof n !== 'object') return;
    const o = n as Record<string, unknown>;
    if (typeof o.action === 'string' && o.action.includes('.')) found.add(o.action);
    Object.values(o).forEach(walk);
  };
  for (const el of Object.values(spec.elements as Record<string, { on?: unknown; watch?: unknown }>)) {
    walk(el.on);
    walk(el.watch);
  }
  return [...found];
}

const writeResult = (store: StateStore, tool: string, data: unknown) => {
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) store.set(`/${MCP}/${tool}/${k}`, v);
};

const functions = new Proxy(
  Object.fromEntries(Object.entries(elements.functions ?? {}).map(([k, f]) => [`${elements.slug}_${k}`, f])) as Record<string, unknown>,
  { get: (t, k: string) => t[k] ?? (() => undefined), has: () => true },
);

async function mount(opts: { fail?: string[]; skip?: string[] } = {}): Promise<Tile> {
  const store = createStateStore({});
  const calls: Tile['calls'] = [];
  const opened: string[] = [];
  const handlers: Record<string, (params: Record<string, unknown>) => Promise<void>> = {};
  for (const name of specActions()) {
    const tool = name.split('.')[1]!;
    handlers[name] = async (params) => {
      calls.push({ tool, params: JSON.parse(JSON.stringify(params ?? {})) });
      store.set(`/_errors/${MCP}.${tool}`, '');
      store.set(`/_loading/${MCP}.${tool}`, true);
      try {
        await new Promise((r) => setTimeout(r, 0));
        if (opts.skip?.includes(tool)) return;
        if (opts.fail?.includes(tool)) {
          store.set(`/_errors/${MCP}.${tool}`, 'Xero returned 400');
          return;
        }
        writeResult(store, tool, XERO[tool]);
      } finally {
        store.set(`/_loading/${MCP}.${tool}`, false);
      }
    };
  }
  handlers.open_url = async (params) => {
    opened.push(String(params.url));
  };
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push(root);
  await act(async () => {
    root.render(h(JSONUIProvider, { registry: {}, store, handlers, functions } as never, h(Renderer, { spec, registry: {}, fallback: Stub } as never)));
  });
  return { store, container, calls, opened };
}

/** The host's dataProvider fetch of list_invoices. */
async function loadInvoices(tile: Tile) {
  await act(async () => {
    tile.store.set(`/_loading/${MCP}.list_invoices`, true);
    writeResult(tile.store, 'list_invoices', XERO.list_invoices);
    tile.store.set(`/_loading/${MCP}.list_invoices`, false);
  });
}

async function settle() {
  for (let i = 0; i < 20; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

const text = (tile: Tile, key: string) => tile.container.querySelector(`[data-key="${key}"]`)?.textContent ?? null;
const tone = (tile: Tile, key: string) => tile.container.querySelector(`[data-key="${key}"]`)?.getAttribute('data-tone') ?? null;

async function click(tile: Tile, key: string) {
  const node = tile.container.querySelector<HTMLElement>(`[data-key="${key}"]`);
  if (!node) throw new Error(`${key} is not rendered`);
  await act(async () => node.click());
}

// ── tests ────────────────────────────────────────────────────────────
describe('Xero Action Queue in the real widget runtime', () => {
  it('waits for Xero before showing anything', async () => {
    const tile = await mount();
    expect(text(tile, 'headSub')).toBe('Waiting for Xero…');
  });

  it('reads the org, bank transactions, payments, bank accounts and expense claims with the right filters', async () => {
    const tile = await mount();
    await loadInvoices(tile);
    await settle();
    const params = Object.fromEntries(tile.calls.map((c) => [c.tool, c.params]));
    expect(Object.keys(params).sort()).toEqual(
      ['get_organisation', 'list_accounts', 'list_bank_transactions', 'list_expense_claims', 'list_payments'].sort(),
    );
    expect(params.list_bank_transactions).toEqual({ where: 'Status=="AUTHORISED"&&IsReconciled==false', order: 'Date DESC' });
    expect(params.list_payments).toEqual({ where: 'Status=="AUTHORISED"&&IsReconciled==false' });
    expect(params.list_accounts).toEqual({ where: 'Type=="BANK"' });
    expect(params.list_expense_claims).toEqual({ where: 'Status=="SUBMITTED"' });
  });

  it('counts unreconciled bank transactions plus bank-account payments, a batch once, and names the org', async () => {
    const tile = await mount();
    await loadInvoices(tile);
    await settle();
    // 3 bank transactions + 1 single payment + 2 batches; the clearing-account payment is left out
    expect(text(tile, 'recCount')).toBe('6');
    expect(text(tile, 'recSub')).toBe('Entered in Xero, not yet reconciled');
    expect(text(tile, 'recBadge')).toBe('To Review');
    expect(text(tile, 'invCount')).toBe('2');
    expect(text(tile, 'billCount')).toBe('1');
    expect(text(tile, 'expCount')).toBe('1');
    expect(text(tile, 'expBadge')).toBe('To Approve');
    expect(tone(tile, 'expBadge')).toBe('warning');
    expect(text(tile, 'headSub')).toBe('Demo Company (AU) · 10 items need your attention');
  });

  it('opens the same organisation in Xero from the reconcile row, its button, the other rows and the footer', async () => {
    const tile = await mount();
    await loadInvoices(tile);
    await settle();
    await click(tile, 'recOpen');
    await click(tile, 'recRow');
    await click(tile, 'invRow');
    await click(tile, 'billRow');
    await click(tile, 'expRow');
    await click(tile, 'footerBtn');
    expect(text(tile, 'recOpen')).toBe('Open in Xero');
    // The stub Row doesn't ignore nested button clicks like the host's does,
    // so the button click is recorded twice here; the host opens one tab.
    expect(new Set(tile.opened.slice(0, 3))).toEqual(new Set([deepLink('/Bank/BankAccounts.aspx')]));
    expect(tile.opened.slice(3)).toEqual([
      deepLink('/AccountsReceivable/Search.aspx?invoiceStatus=INVOICESTATUS/AUTHORISED'),
      deepLink('/AccountsPayable/Search.aspx?invoiceStatus=INVOICESTATUS/AUTHORISED'),
      deepLink('/ExpenseClaims/?status=SUBMITTED'),
      deepLink('/Dashboard/'),
    ]);
  });

  it('falls back to bank transactions alone, and says so, when Xero does not return payments', async () => {
    const tile = await mount({ fail: ['list_payments'] });
    await loadInvoices(tile);
    await settle();
    expect(text(tile, 'recCount')).toBe('3');
    expect(text(tile, 'recSub')).toBe('Bank transactions only: Xero did not return payments');
  });

  it('uses plain Xero links until the organisation is known', async () => {
    const tile = await mount({ fail: ['get_organisation'] });
    await loadInvoices(tile);
    await settle();
    await click(tile, 'recOpen');
    await click(tile, 'footerBtn');
    expect(tile.opened).toEqual(['https://go.xero.com/Bank/BankAccounts.aspx', 'https://go.xero.com/Bank/BankAccounts.aspx', 'https://go.xero.com/']);
    expect(text(tile, 'headSub')).toBe('10 items need your attention');
  });

  it('tones invoices and bills by due date: muted before, warning on, destructive after', async () => {
    const day = (offset: number) => {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      return `/Date(${Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())}+0000)/`;
    };
    const original = XERO.list_invoices;
    XERO.list_invoices = {
      Invoices: [
        { Type: 'ACCREC', DueDate: day(-1) },
        { Type: 'ACCREC', DueDate: day(3) },
        { Type: 'ACCPAY', DueDate: day(0) },
      ],
    };
    try {
      const tile = await mount();
      await loadInvoices(tile);
      await settle();
      expect(text(tile, 'invBadge')).toBe('Overdue');
      expect(tone(tile, 'invBadge')).toBe('destructive');
      expect(text(tile, 'invSub')).toBe('2 outstanding · 1 overdue');
      expect(text(tile, 'billBadge')).toBe('Due Today');
      expect(tone(tile, 'billBadge')).toBe('warning');
      XERO.list_invoices = { Invoices: [{ Type: 'ACCREC', DueDate: day(3) }] };
      const later = await mount();
      await loadInvoices(later);
      await settle();
      expect(text(later, 'invBadge')).toBe('Not Yet Due');
      expect(tone(later, 'invBadge')).toBe('muted');
      expect(text(later, 'invSub')).toBe('1 outstanding');
    } finally {
      XERO.list_invoices = original;
    }
  });

  it('shows a dash, not 0, for a count Xero has not answered yet', async () => {
    const tile = await mount({ skip: ['list_payments'] });
    await loadInvoices(tile);
    await settle();
    expect(text(tile, 'recCount')).toBe('—');
    expect(tile.container.querySelector('[data-key="recBadge"]')).toBeNull();
  });
});
