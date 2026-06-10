const { findArticles } = require('../scrapers/blogs');
const cache = require('../config/cache');
const logger = require('../config/logger');

// GET /api/v1/search/articles?q=iphone+15
// Lazy blog/review strip for the results page — kept separate from the main
// search so blog scraping never slows the product results.
async function searchArticles(req, res) {
  const q = (req.query.q || '').trim();
  if (q.length < 2) {
    return res.status(400).json({ success: false, error: 'Query must be at least 2 characters' });
  }

  const cacheKey = `articles:${q.toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json({ success: true, cached: true, data: cached });

  try {
    const articles = await findArticles(q, 2);
    const data = articles.map((a) => ({
      title: a.title,
      url: a.url,
      source: a.source,
      date: a.date,
      // short snippet for the card
      snippet: (a.text || '').slice(0, 180),
    }));
    cache.set(cacheKey, data);
    return res.json({ success: true, cached: false, data });
  } catch (err) {
    logger.error(`[Articles] error for "${q}": ${err.message}`);
    return res.json({ success: true, cached: false, data: [] }); // soft-fail: empty strip
  }
}

module.exports = { searchArticles };
