const Store = require('../models/Store');
const Product = require('../models/Product');
const PipelineJob = require('../models/PipelineJob');
const { filterOnlineStores } = require('../services/storeHealthChecker');
const { runStores } = require('../services/storeTierRouter');
const { classifyProducts } = require('../services/geminiClassifier');
const { upsertProducts } = require('../services/scraper.service');
const { getReviews } = require('../services/reviewAggregator');
const { dedupeItems } = require('./normaliser');
const { allKeywords, SEED_KEYWORDS } = require('./seedKeywords');
const logger = require('../config/logger');

// Scrape + classify + upsert a single keyword across all given (online) stores.
async function processKeyword(keyword, stores) {
  const { items } = await runStores(stores, keyword, keyword.split(/\s+/), 'islamabad');
  const deduped = dedupeItems(items);
  if (!deduped.length) return { upserted: 0, updated: 0, flagged: 0 };

  const rawForGemini = deduped.map(({ _storeDoc, ...i }) => i);
  const classified = await classifyProducts(rawForGemini);
  const enriched = classified.map((c, i) => ({
    ...c,
    rating: deduped[i]?.rating ?? null,
    _storeDoc: deduped[i]?._storeDoc || null,
  }));

  let upserted = 0;
  let updated = 0;
  let flagged = 0;
  const byStore = new Map();
  for (const it of enriched) {
    if (!it._storeDoc) continue;
    const id = it._storeDoc._id.toString();
    if (!byStore.has(id)) byStore.set(id, { store: it._storeDoc, items: [] });
    byStore.get(id).items.push(it);
    if (it.confidence < 0.8) flagged++;
  }
  for (const { store, items: storeItems } of byStore.values()) {
    const r = await upsertProducts(storeItems, store._id);
    upserted += r.upserted;
    updated += r.updated;
    store.last_checked_at = new Date();
    await store.save().catch(() => {});
  }
  return { upserted, updated, flagged };
}

// Run a keyword scrape cycle, logging a PipelineJob. jobType = full_refresh | price_refresh
async function runKeywordCycle(keywords, jobType) {
  const job = await PipelineJob.create({ job_type: jobType, status: 'running', started_at: new Date() });
  logger.info(`[Pipeline] ${jobType} starting — ${keywords.length} keywords`);

  try {
    const allStores = await Store.find({});
    const online = await filterOnlineStores(allStores);

    let records = 0;
    let flagged = 0;
    for (const kw of keywords) {
      try {
        const r = await processKeyword(kw, online);
        records += r.upserted + r.updated;
        flagged += r.flagged;
      } catch (err) {
        logger.warn(`[Pipeline] keyword "${kw}" failed: ${err.message}`);
      }
    }

    job.status = 'done';
    job.keywords_processed = keywords.length;
    job.records_fetched = records;
    job.flagged_records = flagged;
    job.finished_at = new Date();
    await job.save();
    logger.info(`[Pipeline] ${jobType} done — ${records} records, ${flagged} flagged`);
    return { keywords: keywords.length, records, flagged };
  } catch (err) {
    job.status = 'failed';
    job.error_log = err.message;
    job.finished_at = new Date();
    await job.save().catch(() => {});
    logger.error(`[Pipeline] ${jobType} failed: ${err.message}`);
    throw err;
  }
}

// Full refresh — every seed keyword across all stores (every 6h)
function runFullRefresh() {
  return runKeywordCycle(allKeywords(), 'full_refresh');
}

// Price refresh — lighter hot subset (first keyword per category, every 2h).
// Prices update via upsertProducts' price_history logic when they change.
function runPriceRefresh() {
  const hot = Object.values(SEED_KEYWORDS).map((list) => list[0]).filter(Boolean);
  return runKeywordCycle(hot, 'price_refresh');
}

// Blog review-gap worker — bounded: fill review scores for recent products
// that have none. getReviews() caches results to the Review collection.
async function runBlogRefresh(limit = 10) {
  const job = await PipelineJob.create({ job_type: 'blog', status: 'running', started_at: new Date() });
  try {
    const products = await Product.find({}).sort({ updatedAt: -1 }).limit(limit);
    let scored = 0;
    for (const p of products) {
      try {
        const r = await getReviews(p._id);
        if (r && r.count > 0) scored++;
      } catch (err) {
        logger.warn(`[Pipeline] blog review for ${p._id} failed: ${err.message}`);
      }
    }
    job.status = 'done';
    job.records_fetched = scored;
    job.finished_at = new Date();
    await job.save();
    logger.info(`[Pipeline] blog refresh done — ${scored}/${products.length} products scored`);
    return { checked: products.length, scored };
  } catch (err) {
    job.status = 'failed';
    job.error_log = err.message;
    job.finished_at = new Date();
    await job.save().catch(() => {});
    throw err;
  }
}

module.exports = { runFullRefresh, runPriceRefresh, runBlogRefresh, processKeyword, runKeywordCycle };
