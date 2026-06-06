const { newPage } = require('../puppeteer/browser');
const { randomUA } = require('../utils/userAgent');
const logger = require('../../config/logger');

// PriceOye renders user reviews in the product page DOM. Best-effort scrape —
// selectors vary, so we try several and return [] if none match.
async function fetchReviews(sourceUrl, maxReviews = 20) {
  if (!sourceUrl) return [];
  const page = await newPage(randomUA());
  try {
    await page.goto(sourceUrl, { waitUntil: 'networkidle2', timeout: 15000 });
    await page.waitForSelector('.review-item, .user-review, [class*="review"]', { timeout: 5000 }).catch(() => {});

    const raw = await page.evaluate(() => {
      const blocks = document.querySelectorAll('.review-item, .user-review, .review-box, [class*="review-card"]');
      return Array.from(blocks).slice(0, 30).map((el) => {
        const textEl = el.querySelector('.review-text, .comment, p, .review-desc');
        const dateEl = el.querySelector('.review-date, time, .date');
        // Count filled stars, or read a numeric rating attribute/text
        const filledStars = el.querySelectorAll('.star.filled, .fa-star.checked, [class*="star-fill"]').length;
        const ratingEl = el.querySelector('[class*="rating"]');
        const ratingMatch = (ratingEl?.innerText || '').match(/\d+(?:\.\d+)?/);

        return {
          text: (textEl?.innerText || '').trim(),
          dateText: (dateEl?.getAttribute('datetime') || dateEl?.innerText || '').trim(),
          stars: filledStars,
          ratingText: ratingMatch ? ratingMatch[0] : '',
        };
      });
    }).catch(() => []);

    const reviews = raw
      .map((r) => {
        let score = r.stars > 0 ? r.stars : parseFloat(r.ratingText) || null;
        if (score && score > 5) score = 5;
        const date = r.dateText ? new Date(r.dateText) : null;
        return {
          score,
          review_text: r.text,
          review_date: date && !isNaN(date.getTime()) ? date : null,
        };
      })
      .filter((r) => r.score !== null && r.review_date)
      .slice(0, maxReviews);

    logger.info(`[Reviews:PriceOye] ${sourceUrl} → ${reviews.length} reviews`);
    return reviews;
  } catch (err) {
    logger.warn(`[Reviews:PriceOye] fetch failed: ${err.message}`);
    return [];
  } finally {
    await page.close().catch(() => {});
  }
}

module.exports = { fetchReviews };
