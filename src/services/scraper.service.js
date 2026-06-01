const Product = require('../models/Product');
const logger = require('../config/logger');

// Upsert products — dedup by (store_id, source_url)
// Same product found again → update price + append to price history
async function upsertProducts(classifiedItems, storeId) {
  const results = { upserted: 0, updated: 0, skipped: 0 };

  for (const item of classifiedItems) {
    if (!item.source_url || item.price_pkr <= 0) {
      results.skipped++;
      continue;
    }

    try {
      const existing = await Product.findOne({ store_id: storeId, source_url: item.source_url });

      if (existing) {
        // Price changed → append to history
        if (existing.price_pkr !== item.price_pkr) {
          existing.price_history.push({ price_pkr: existing.price_pkr, recorded_at: existing.updatedAt });
        }
        existing.price_pkr = item.price_pkr;
        existing.name_en = item.name_en || existing.name_en;
        existing.name_ur = item.name_ur || existing.name_ur;
        existing.image_url = item.image_url || existing.image_url;
        existing.timeframe_tag = item.timeframe_tag || existing.timeframe_tag;
        existing.confidence = item.confidence ?? existing.confidence;
        existing.flagged = item.confidence < 0.8;
        await existing.save();
        results.updated++;
      } else {
        await Product.create({
          name_en: item.name_en,
          name_ur: item.name_ur || '',
          store_id: storeId,
          category: item.category || 'A',
          price_pkr: item.price_pkr,
          source_url: item.source_url,
          image_url: item.image_url || '',
          timeframe_tag: item.timeframe_tag || 'fresh',
          confidence: item.confidence ?? 1.0,
          flagged: item.confidence < 0.8,
          price_history: [],
        });
        results.upserted++;
      }
    } catch (err) {
      logger.error(`[ScraperService] upsert error: ${err.message}`);
      results.skipped++;
    }
  }

  logger.info(`[ScraperService] upserted=${results.upserted} updated=${results.updated} skipped=${results.skipped}`);
  return results;
}

module.exports = { upsertProducts };
