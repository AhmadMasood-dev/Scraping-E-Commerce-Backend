const axios = require('axios');
const logger = require('../../config/logger');

// Daraz product pages expose a public review API keyed by itemId.
// Product URLs look like: .../products/<slug>-i<itemId>-s<skuId>.html
const REVIEW_API = 'https://my.daraz.pk/pdp/review/getReviewList/';

// Pure: pull the itemId out of a Daraz product URL. Returns null if not found.
function extractItemId(url) {
  if (!url) return null;
  const m = String(url).match(/-i(\d+)(?:-s\d+)?\.html/i);
  return m ? m[1] : null;
}

// Normalise Daraz's reviewTime (epoch ms, epoch s, or date string) → Date
function parseReviewDate(raw) {
  if (!raw) return null;
  if (typeof raw === 'number') {
    const ms = raw < 1e12 ? raw * 1000 : raw; // seconds vs ms
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

async function fetchReviews(sourceUrl, maxReviews = 20) {
  const itemId = extractItemId(sourceUrl);
  if (!itemId) {
    logger.info('[Reviews:Daraz] No itemId in URL, skipping');
    return [];
  }

  try {
    const { data } = await axios.get(REVIEW_API, {
      params: { itemId, pageSize: maxReviews, filter: 0, sort: 0 },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
        Accept: 'application/json',
        Referer: sourceUrl,
      },
      timeout: 12000,
    });

    const items = data?.model?.items || [];
    const reviews = items
      .map((it) => ({
        score: typeof it.rating === 'number' ? it.rating : parseFloat(it.rating) || null,
        review_text: (it.reviewContent || '').trim(),
        review_date: parseReviewDate(it.reviewTime || it.reviewTimeStamp),
      }))
      .filter((r) => r.score !== null && r.review_date);

    logger.info(`[Reviews:Daraz] itemId=${itemId} → ${reviews.length} reviews`);
    return reviews;
  } catch (err) {
    logger.warn(`[Reviews:Daraz] fetch failed: ${err.message}`);
    return [];
  }
}

module.exports = { fetchReviews, extractItemId, parseReviewDate };
