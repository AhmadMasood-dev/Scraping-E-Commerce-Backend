const darazReviews = require('./daraz');
const priceoyeReviews = require('./priceoye');
const { withTimeout } = require('../utils/withTimeout');
const logger = require('../../config/logger');

// Registry: store name → its user-review scraper.
// Stores without an entry simply have no store reviews (→ blog fallback).
const REVIEW_SCRAPERS = {
  Daraz: darazReviews.fetchReviews,
  PriceOye: priceoyeReviews.fetchReviews,
};

// Fetch user reviews for a product from its store.
// Returns: [{ score (0–5), review_text, review_date }]
async function fetchStoreReviews(storeName, sourceUrl) {
  const scraper = REVIEW_SCRAPERS[storeName];
  if (!scraper) {
    logger.info(`[Reviews] No review scraper for store "${storeName}"`);
    return [];
  }
  return withTimeout(() => scraper(sourceUrl), 15000, `Reviews:${storeName}`);
}

module.exports = { fetchStoreReviews, REVIEW_SCRAPERS };
