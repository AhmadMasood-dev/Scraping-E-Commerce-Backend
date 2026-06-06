const Review = require('../models/Review');
const Product = require('../models/Product');
const Store = require('../models/Store');
const { fetchStoreReviews } = require('../scrapers/reviews');
const { findArticles } = require('../scrapers/blogs');
const { scoreBlogSentiment } = require('./sentiment');
const { decayFor, aggregateScore } = require('./reviewDecay');
const logger = require('../config/logger');

// Two-track review engine:
//   1. User reviews from the store (source: user_review)
//   2. If none → blog sentiment fallback (source: blog_sentiment)
// Results are cached in the Review collection so we scrape/score only once.

function shapeReview(r) {
  const { weight, within_timeframe } = decayFor(r.review_date);
  return {
    source: r.source,
    score: r.score,
    review_text: r.review_text || '',
    review_date: r.review_date,
    blog_url: r.blog_url || '',
    timeframe_weight: weight,
    within_timeframe,
  };
}

function buildResponse(reviews) {
  if (!reviews.length) {
    return { type: 'none', aggregate_score: null, count: 0, reviews: [] };
  }
  const type = reviews[0].source; // all reviews share a source per product
  return {
    type,
    aggregate_score: aggregateScore(reviews),
    count: reviews.length,
    reviews: reviews.map(shapeReview),
  };
}

// Persist freshly-collected reviews to the Review collection
async function persist(productId, reviews) {
  const docs = reviews
    .filter((r) => typeof r.score === 'number' && r.score !== null)
    .map((r) => {
      const { weight, within_timeframe } = decayFor(r.review_date);
      return {
        product_id: productId,
        source: r.source,
        score: r.score,
        review_text: r.review_text || '',
        review_date: r.review_date || new Date(),
        timeframe_weight: weight,
        within_timeframe,
        blog_url: r.blog_url || '',
      };
    });
  if (docs.length) {
    await Review.insertMany(docs).catch((e) => logger.error(`[ReviewAgg] persist error: ${e.message}`));
  }
  return docs;
}

async function getReviews(productId) {
  // 1. Cached reviews already in DB?
  const cached = await Review.find({ product_id: productId }).lean();
  if (cached.length > 0) {
    logger.info(`[ReviewAgg] ${productId} → ${cached.length} cached reviews`);
    return buildResponse(cached);
  }

  // 2. Load product + store
  const product = await Product.findById(productId).lean();
  if (!product) return { type: 'none', aggregate_score: null, count: 0, reviews: [] };

  const store = product.store_id ? await Store.findById(product.store_id).lean() : null;
  const storeName = store?.name;

  // 3. Track 1 — store user reviews
  if (storeName && product.source_url) {
    const storeReviews = await fetchStoreReviews(storeName, product.source_url);
    if (storeReviews.length > 0) {
      const tagged = storeReviews.map((r) => ({ ...r, source: 'user_review' }));
      await persist(productId, tagged);
      logger.info(`[ReviewAgg] ${productId} → ${tagged.length} store reviews`);
      return buildResponse(tagged.map((r) => ({ ...r, source: 'user_review' })));
    }
  }

  // 4. Track 2 — blog sentiment fallback
  const articles = await findArticles(product.name_en);
  const blogReviews = [];
  for (const article of articles) {
    const { score, summary } = await scoreBlogSentiment(product.name_en, article.text);
    if (typeof score === 'number') {
      blogReviews.push({
        source: 'blog_sentiment',
        score,
        review_text: summary || article.title,
        review_date: article.date || null,
        blog_url: article.url,
      });
    }
  }

  if (blogReviews.length > 0) {
    await persist(productId, blogReviews);
    logger.info(`[ReviewAgg] ${productId} → ${blogReviews.length} blog-sentiment reviews`);
    return buildResponse(blogReviews);
  }

  logger.info(`[ReviewAgg] ${productId} → no reviews from any source`);
  return { type: 'none', aggregate_score: null, count: 0, reviews: [] };
}

module.exports = { getReviews, buildResponse, shapeReview };
