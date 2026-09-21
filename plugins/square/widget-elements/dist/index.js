const STATUS_LABEL = {
    OPEN: 'Open', COMPLETED: 'Completed', CANCELED: 'Cancelled',
};
const STATUS_TONE = {
    OPEN: 'info', COMPLETED: 'success', CANCELED: 'muted',
};
const enrich_orders = (args) => {
    const orders = args.value;
    if (!Array.isArray(orders))
        return [];
    return orders.map((o) => {
        const order = o;
        const state = String(order.state ?? '');
        return {
            ...order,
            order_id_short: `#${String(order.id ?? '').slice(-8).toUpperCase()}`,
            status_label: STATUS_LABEL[state] ?? state,
            status_tone: STATUS_TONE[state] ?? 'muted',
        };
    });
};
const mod = {
    slug: 'square',
    functions: { enrich_orders },
};
export default mod;
