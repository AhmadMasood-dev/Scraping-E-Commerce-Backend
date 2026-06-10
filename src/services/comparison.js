const { group } = require('../scrapers/utils/productMatcher');

// Shape a single enriched item into a comparison entry.
function toEntry(item) {
  return {
    store_name: item._storeDoc?.name || item.store_name || '',
    price_pkr: item.price_pkr || 0,
    source_url: item.source_url || '',
    image_url: item.image_url || '',
    rating: item.rating ?? null,
    name_en: item.name_en || '',
    name_ur: item.name_ur || '',
    category: item.category || 'A',
  };
}

// Build the cross-store comparison view from classified+enriched search items.
// Returns:
//   primary      — best matched cluster (most stores), entries sorted cheapest-first,
//                  with cheapest_store, has_comparison, savings
//   storeResults — the cheapest item per store (for the "by store" sections)
function buildComparison(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return { primary: null, storeResults: [] };
  }

  // ── storeResults: cheapest item per store ──────────────────────────────────
  const byStore = new Map();
  for (const it of items) {
    const store = it._storeDoc?.name || it.store_name || 'Unknown';
    const price = it.price_pkr || 0;
    if (price <= 0) continue;
    const cur = byStore.get(store);
    if (!cur || price < cur.price_pkr) byStore.set(store, toEntry(it));
  }
  const storeResults = [...byStore.values()];

  // ── primary: largest cross-store cluster ───────────────────────────────────
  const clusters = group(items, 'name_en');
  // Prefer the cluster spanning the most distinct stores, then most items.
  let best = null;
  let bestStores = 0;
  for (const c of clusters) {
    const stores = new Set(c.map((i) => i._storeDoc?.name || i.store_name)).size;
    if (stores > bestStores || (stores === bestStores && (!best || c.length > best.length))) {
      best = c;
      bestStores = stores;
    }
  }
  if (!best) return { primary: null, storeResults };

  // One comparison entry per store (cheapest), sorted cheapest-first
  const entriesByStore = new Map();
  for (const it of best) {
    const price = it.price_pkr || 0;
    if (price <= 0) continue;
    const store = it._storeDoc?.name || it.store_name || 'Unknown';
    const cur = entriesByStore.get(store);
    if (!cur || price < cur.price_pkr) entriesByStore.set(store, toEntry(it));
  }
  const comparisons = [...entriesByStore.values()].sort((a, b) => a.price_pkr - b.price_pkr);

  if (comparisons.length === 0) return { primary: null, storeResults };

  const head = best[0];
  const cheapest = comparisons[0];
  const highest = comparisons[comparisons.length - 1];

  const primary = {
    name_en: head.name_en || '',
    name_ur: head.name_ur || '',
    category: head.category || 'A',
    image_url: comparisons.find((c) => c.image_url)?.image_url || '',
    rating: head.rating ?? null,
    comparisons,
    cheapest_store: cheapest.store_name,
    has_comparison: comparisons.length > 1,
    savings: comparisons.length > 1 ? highest.price_pkr - cheapest.price_pkr : 0,
  };

  return { primary, storeResults };
}

module.exports = { buildComparison };
