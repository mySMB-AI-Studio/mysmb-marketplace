// TILE-DISPLAY-STANDARDS.md §2: always pass `currency` explicitly rather
// than relying on the shared `currency` cell formatter's silent AUD
// default — but `Table` columns only take a flat field, no per-cell
// `$computed` args, so there's no column-level way to pass one through.
// Formatting the price string here instead makes the currency an explicit,
// visible choice rather than an accidental default landing on the right
// answer. AUD matches this connector's actual store region (X-Series
// AU/NZ retailer, tax-inclusive pricing) — revisit if a non-AU Lightspeed
// store is ever connected through this same plugin.
function formatAud(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'AUD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
}
// Product category is a portal-defined, open-ended label with no inherent
// good/bad meaning — a categorical (non-status) breakdown per
// TILE-DISPLAY-STANDARDS.md §7, which calls for the `chart-1`..`chart-5`
// palette rather than a status tone. Categories are ranked by count (most
// common first) and assigned tones in that order; a catalog with more than
// 5 distinct categories cycles back through the same 5 tones rather than
// crashing or falling back to a status tone.
const CHART_TONES = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'];
/** Most-common-first tone assignment, shared by row badges and the breakdown bar. */
function rankCategoryTones(categories) {
    const counts = new Map();
    for (const category of categories)
        counts.set(category, (counts.get(category) ?? 0) + 1);
    const toneByCategory = new Map();
    [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .forEach(([category], i) => toneByCategory.set(category, CHART_TONES[i % CHART_TONES.length]));
    return toneByCategory;
}
/**
 * Flattens a `list_products` response into catalog rows for the Product
 * Catalog tile, excluding Lightspeed's own system-generated "Discount" line
 * product (`source: "SYSTEM"`, `has_inventory: false`) — a checkout
 * mechanism, not a real catalog item, so it would misrepresent the catalog
 * if counted or listed alongside real products.
 *
 * X-Series returns one row per sellable variant (not per parent product) —
 * `variant_name` (e.g. "Nala Dress / 8") is what's shown, since that's the
 * actual sellable unit with its own SKU and price; `product_category`/
 * `brand`/`supplier` are nullable on the raw record, so each falls back to
 * an honest placeholder rather than a blank cell.
 *
 * Each row also carries `categoryTone` (`chart-1..5`, ranked most-common
 * category first) so a row's category pill and the breakdown bar's segment
 * for that same category always share one color — `lightspeed_category_
 * breakdown` reads this same field rather than re-ranking independently,
 * so the two can't drift apart.
 *
 * Args: { products: array }
 * Returns: array of { id, name, category, categoryTone, brand, supplier, price, active }
 *
 * Spec example:
 *   {
 *     "$computed": "lightspeed_catalog_rows",
 *     "args": { "products": { "$state": "/lightspeed/list_products/data" } }
 *   }
 */
const catalog_rows = (args) => {
    const products = Array.isArray(args.products) ? args.products : [];
    const realProducts = products.filter((product) => product.source !== 'SYSTEM');
    const categories = realProducts.map((product) => product.product_category?.name ?? 'Uncategorized');
    const toneByCategory = rankCategoryTones(categories);
    return realProducts.map((product, i) => {
        const brand = product.brand;
        const supplier = product.supplier;
        const priceIncTax = product.price_including_tax;
        const priceExTax = product.price_excluding_tax;
        const price = typeof priceIncTax === 'number' ? priceIncTax : typeof priceExTax === 'number' ? priceExTax : 0;
        const category = categories[i];
        return {
            id: product.id,
            name: product.variant_name ?? product.name ?? 'Untitled product',
            category,
            categoryTone: toneByCategory.get(category) ?? 'muted',
            brand: brand?.name ?? '—',
            supplier: supplier?.name ?? '—',
            price: formatAud(price),
            active: product.active !== false,
        };
    });
};
/**
 * Groups Product Catalog rows (from `lightspeed_catalog_rows`) into a
 * category breakdown — count per category, ranked most-common first. Reads
 * each row's already-assigned `categoryTone` rather than re-ranking, so the
 * bar's segment colors always match the table's row pill colors for the
 * same category.
 *
 * Args: { rows: array }
 * Returns: { total, segments: [{ category, count, tone }], template }
 *
 * Spec example:
 *   {
 *     "$computed": "lightspeed_category_breakdown",
 *     "args": { "rows": { "$state": "/ui/rows" } }
 *   }
 */
const category_breakdown = (args) => {
    const rows = Array.isArray(args.rows) ? args.rows : [];
    const counts = new Map();
    const toneByCategory = new Map();
    for (const row of rows) {
        const category = typeof row.category === 'string' && row.category ? row.category : 'Uncategorized';
        counts.set(category, (counts.get(category) ?? 0) + 1);
        if (!toneByCategory.has(category)) {
            toneByCategory.set(category, typeof row.categoryTone === 'string' ? row.categoryTone : 'muted');
        }
    }
    const segments = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([category, count]) => ({ category, count, tone: toneByCategory.get(category) ?? 'muted' }));
    return {
        total: rows.length,
        segments,
        template: segments.length ? segments.map((s) => `${s.count}fr`).join(' ') : '1fr',
    };
};
/**
 * Groups a `list_products` response into a Brands breakdown for the Brands
 * tile — count of products per brand, ranked most-common first, each
 * assigned a `chart-1..5` tone (brand is a portal-defined, non-status
 * label, same categorical case as product category). Excludes Lightspeed's
 * own system-generated "Discount" line product, same as
 * `lightspeed_catalog_rows` — it has no real brand and would otherwise
 * inflate an "Unbranded" bucket with a non-product.
 *
 * A product with no brand set (`brand: null`) is grouped under
 * "Unbranded" rather than dropped, since that's a real, honest state for
 * that product — not an error.
 *
 * Args: { products: array }
 * Returns: { total, segments: [{ brand, count, tone }], template }
 *
 * Spec example:
 *   {
 *     "$computed": "lightspeed_brand_breakdown",
 *     "args": { "products": { "$state": "/lightspeed/list_products/data" } }
 *   }
 */
const brand_breakdown = (args) => {
    const products = Array.isArray(args.products) ? args.products : [];
    const realProducts = products.filter((product) => product.source !== 'SYSTEM');
    const counts = new Map();
    for (const product of realProducts) {
        const brand = product.brand?.name ?? 'Unbranded';
        counts.set(brand, (counts.get(brand) ?? 0) + 1);
    }
    const segments = [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([brand, count], i) => ({ brand, count, tone: CHART_TONES[i % CHART_TONES.length] }));
    return {
        total: realProducts.length,
        segments,
        template: segments.length ? segments.map((s) => `${s.count}fr`).join(' ') : '1fr',
    };
};
const elements = {
    slug: 'lightspeed',
    functions: {
        catalog_rows,
        category_breakdown,
        brand_breakdown,
    },
};
export default elements;
