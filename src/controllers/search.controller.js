const { processQuery } = require('../nlp/processor');
const { getEligibleStores } = require('../services/locationResolver');
const { filterOnlineStores } = require('../services/storeHealthChecker');
const { runStores } = require('../services/storeTierRouter');
const { classifyProducts } = require('../services/geminiClassifier');
const { upsertProducts } = require('../services/scraper.service');
const cache = require('../config/cache');
const logger = require('../config/logger');

async function search(req, res) {
  const startMs = Date.now();

  try {
    const { query, city = 'islamabad', lang } = req.query;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Query must be at least 2 characters' });
    }

    // ── 1. NLP ────────────────────────────────────────────────────────────────
    const nlp = await processQuery(query.trim(), lang);
    logger.info(`[Search] query="${nlp.original}" lang=${nlp.language} city=${city}`);

    // ── 2. Cache check ────────────────────────────────────────────────────────
    const cacheKey = `search:${nlp.normalized}:${city.toLowerCase()}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      logger.info(`[Search] Cache hit ${cacheKey} (${Date.now() - startMs}ms)`);
      return res.json({ success: true, cached: true, ...cached });
    }

    // ── 3. Location → eligible stores ─────────────────────────────────────────
    const stores = await getEligibleStores(city);
    if (!stores.length) {
      return res.json({
        success: true,
        cached: false,
        results: { A: [], B: [], C: [], D: [] },
        meta: { city, language: nlp.language, stores_searched: 0, total: 0, durationMs: Date.now() - startMs },
      });
    }

    // ── 3b. Live health check → keep only stores that respond right now ───────
    const liveStores = await filterOnlineStores(stores);
    // partial = at least one eligible store was offline (skipped by the health check),
    // so the user is seeing fewer sources than exist for this city.
    const partial = liveStores.length < stores.length;

    if (!liveStores.length) {
      return res.json({
        success: true,
        cached: false,
        results: { A: [], B: [], C: [], D: [] },
        meta: { city, language: nlp.language, stores_searched: 0, total: 0, partial, durationMs: Date.now() - startMs },
      });
    }

    // ── 4. Scrape all live stores in parallel ─────────────────────────────────
    const { items: rawItems, meta: scrapeMeta } = await runStores(
      liveStores,
      nlp.normalized,
      nlp.keywords,
      city
    );

    // Stores actually attempted by a scraper (runStores skips stores with no scraper)
    const storesSearched = scrapeMeta.successStores.length + scrapeMeta.failedStores.length;

    if (!rawItems.length) {
      return res.json({
        success: true,
        cached: false,
        results: { A: [], B: [], C: [], D: [] },
        meta: {
          city,
          language: nlp.language,
          stores_searched: storesSearched,
          total: 0,
          partial,
          ...scrapeMeta,
        },
      });
    }

    // ── 5. Gemini classification ──────────────────────────────────────────────
    const rawForGemini = rawItems.map(({ _storeDoc, ...item }) => item);
    const classified = await classifyProducts(rawForGemini);

    // Re-attach store docs
    const enriched = classified.map((item, i) => ({
      ...item,
      _storeDoc: rawItems[i]?._storeDoc || null,
    }));

    // ── 6. Background DB upsert ───────────────────────────────────────────────
    // Don't block the response — fire and forget
    setImmediate(() => {
      const byStore = new Map();
      for (const item of enriched) {
        if (!item._storeDoc) continue;
        const id = item._storeDoc._id.toString();
        if (!byStore.has(id)) byStore.set(id, { store: item._storeDoc, items: [] });
        byStore.get(id).items.push(item);
      }
      for (const { store, items } of byStore.values()) {
        upsertProducts(items, store._id).catch((e) =>
          logger.error(`[Search] upsert error (${store.name}): ${e.message}`)
        );
        store.last_checked_at = new Date();
        store.save().catch(() => {});
      }
    });

    // ── 7. Group by category ──────────────────────────────────────────────────
    const grouped = { A: [], B: [], C: [], D: [] };
    for (const item of enriched) {
      const cat = item.category || 'A';
      if (grouped[cat]) grouped[cat].push(formatProduct(item));
    }

    const totalMs = Date.now() - startMs;
    const payload = {
      results: grouped,
      meta: {
        city,
        language: nlp.language,
        timeframe: nlp.timeframe,
        stores_searched: storesSearched,
        total: enriched.length,
        durationMs: totalMs,
        partial,
        ...scrapeMeta,
      },
    };

    cache.set(cacheKey, payload);
    logger.info(`[Search] Completed in ${totalMs}ms — ${enriched.length} products`);
    return res.json({ success: true, cached: false, ...payload });
  } catch (err) {
    logger.error(`[Search] Unhandled: ${err.message}\n${err.stack}`);
    return res.status(500).json({ success: false, error: 'Search failed. Please try again.' });
  }
}

function formatProduct(item) {
  return {
    name_en: item.name_en || '',
    name_ur: item.name_ur || '',
    price_pkr: item.price_pkr || 0,
    image_url: item.image_url || '',
    source_url: item.source_url || '',
    store_name: item._storeDoc?.name || item.store_name || '',
    category: item.category || 'A',
    timeframe_tag: item.timeframe_tag || 'fresh',
    confidence: item.confidence ?? 1.0,
    review_score: item.review_score ?? null,
    review_source: item.review_source ?? null,
  };
}

module.exports = { search };
