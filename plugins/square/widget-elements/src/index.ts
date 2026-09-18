import type { ComputedFunction, PluginElementsModule } from './types';

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Open', COMPLETED: 'Completed', CANCELED: 'Cancelled',
};
const STATUS_TONE: Record<string, string> = {
  OPEN: 'info', COMPLETED: 'success', CANCELED: 'muted',
};

const enrich_orders: ComputedFunction = (args) => {
  const orders = args.value;
  if (!Array.isArray(orders)) return [];
  return orders.map((o) => {
    const order = o as Record<string, unknown>;
    const state = String(order.state ?? '');
    return {
      ...order,
      order_id_short: `#${String(order.id ?? '').slice(-8).toUpperCase()}`,
      status_label: STATUS_LABEL[state] ?? state,
      status_tone: STATUS_TONE[state] ?? 'muted',
    };
  });
};

const mod: PluginElementsModule = {
  slug: 'square',
  functions: { enrich_orders },
};

export default mod;
