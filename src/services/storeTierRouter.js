const { searchDaraz } = require('../scrapers/apis/daraz');
const { scrape: scrapeTelemart } = require('../scrapers/puppeteer/telemart');
const { scrape: scrapePriceOye } = require('../scrapers/puppeteer/priceoye');
const { scrape: scrapePakWheels } = require('../scrapers/puppeteer/pakwheels');
const { scrapeCheerio } = require('../scrapers/cheerio');
const { withTimeout } = require('../scrapers/utils/withTimeout');
const logger = require('../config/logger');

// Lowered from 15s: Daraz(API)/Cheerio respond in ~1-3s, Puppeteer in ~5-9s once the
// singleton browser is warm. 10s caps the tail without cutting off healthy responders.
const SCRAPE_TIMEOUT_MS = 10000;

// Query-relevance gates: a niche store only runs when the query matches its focus, so
// adding more niche stores does NOT slow unrelated searches (and avoids wasted Puppeteer
// launches). Stores with NO gate here are general marketplaces and always run.
const STORE_GATES = {
  Pakfan: /\b(fan|ceiling|pedestal|exhaust|cooler|heater|geyser|iron|kettle|blender|juicer|appliance)\b/i,
  PakWheels: /\b(car|honda|toyota|suzuki|civic|corolla|mehran|alto|cultus|vitz|yaris|hybrid|vehicle|jeep|4x4|bike|motorcycle)\b/i,
};

// True if a store should run for this query (no gate = always run).
function storeMatchesQuery(name, query, keywords) {
  const gate = STORE_GATES[name];
  if (!gate) return true;
  if (gate.test(query || '')) return true;
  return (keywords || []).some((k) => gate.test(k));
}

// Maps store name → scraper function
// Each scraper returns: [{ name, price, image_url, source_url, store_name, ... }]
const SCRAPER_MAP = {
  Daraz: (query, _keywords, _city) =>
    withTimeout(() => searchDaraz(query), SCRAPE_TIMEOUT_MS, 'Daraz'),

  Telemart: (query, _keywords, _city) =>
    withTimeout(() => scrapeTelemart(query), SCRAPE_TIMEOUT_MS, 'Telemart'),

  PriceOye: (query, _keywords, _city) =>
    withTimeout(() => scrapePriceOye(query), SCRAPE_TIMEOUT_MS, 'PriceOye'),

  PakWheels: (query, keywords, city) =>
    withTimeout(() => scrapePakWheels(query, keywords, city), SCRAPE_TIMEOUT_MS, 'PakWheels'),

  // Category C — Cheerio (scrapeCheerio already wraps itself in withTimeout)
  Shophive: (query) => scrapeCheerio('Shophive', query),
  Pakfan: (query) => scrapeCheerio('Pakfan', query),
};

// Run all eligible stores in parallel — failures are isolated (Promise.allSettled)
// Returns: { items: [...], meta: { successStores, failedStores, durationMs } }
async function runStores(stores, query, keywords, city) {
  const start = Date.now();

  const tasks = stores
    .filter((store) => SCRAPER_MAP[store.name]) // skip stores with no scraper yet
    .filter((store) => storeMatchesQuery(store.name, query, keywords)) // skip niche stores irrelevant to this query
    .map((store) => ({
      store,
      promise: SCRAPER_MAP[store.name](query, keywords, city).catch((err) => {
        logger.error(`[Router] ${store.name} unexpected error: ${err.message}`);
        return [];
      }),
    }));

  if (tasks.length === 0) {
    return { items: [], meta: { successStores: [], failedStores: [], durationMs: 0 } };
  }

  const settled = await Promise.allSettled(tasks.map((t) => t.promise));

  const successStores = [];
  const failedStores = [];
  let items = [];

  settled.forEach((result, i) => {
    const storeName = tasks[i].store.name;
    if (result.status === 'fulfilled' && Array.isArray(result.value) && result.value.length > 0) {
      successStores.push(storeName);
      // Attach store doc to each item for upsert later
      items = items.concat(result.value.map((item) => ({ ...item, _storeDoc: tasks[i].store })));
    } else {
      failedStores.push(storeName);
      if (result.status === 'rejected') {
        logger.warn(`[Router] ${storeName} rejected: ${result.reason?.message}`);
      } else {
        logger.info(`[Router] ${storeName} returned 0 results`);
      }
    }
  });

  const durationMs = Date.now() - start;
  logger.info(
    `[Router] Done in ${durationMs}ms — success: [${successStores.join(', ')}] failed: [${failedStores.join(', ')}]`
  );

  return { items, meta: { successStores, failedStores, durationMs } };
}

module.exports = { runStores, storeMatchesQuery, STORE_GATES, SCRAPE_TIMEOUT_MS };
