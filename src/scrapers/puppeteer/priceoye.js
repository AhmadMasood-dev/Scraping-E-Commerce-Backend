const { newPage } = require('./browser');
const { randomUA } = require('../utils/userAgent');
const { parsePrice } = require('../utils/parsePrice');
const logger = require('../../config/logger');

const STORE_NAME = 'PriceOye';
const BASE_URL = 'https://priceoye.pk';

// PriceOye is a Next.js price comparison site — electronics focused.
// Product cards live inside .productBox / .product-card containers.
async function scrape(query) {
  const page = await newPage(randomUA());
  try {
    const url = `${BASE_URL}/search?q=${encodeURIComponent(query)}`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
    await page
      .waitForSelector('.productBox, .product-card, [data-product-id]', { timeout: 6000 })
      .catch(() => {});
    await new Promise((r) => setTimeout(r, 300));

    const raw = await page.evaluate((base) => {
      const cards = document.querySelectorAll(
        '.productBox, .product-card, .product-item, [data-product-id]'
      );
      return Array.from(cards)
        .slice(0, 20)
        .map((el) => {
          const titleEl = el.querySelector('.p-title, .product-title, h3, h4, a[title]');
          const priceEl = el.querySelector(
            '.price-box .price, .product-price, [class*="price"], .new-price'
          );
          const linkEl = el.matches('a[href]') ? el : el.querySelector('a[href]');
          const imgEl = el.querySelector('img');
          const ratingEl = el.querySelector('.rating-num, [class*="rating"], .stars');

          const title = (titleEl?.innerText || titleEl?.getAttribute('title') || '').trim();
          const priceText = (priceEl?.innerText || priceEl?.textContent || '').replace(/[^\d]/g, '');
          const price = priceText ? parseInt(priceText, 10) : 0;

          let source_url = linkEl?.href || '';
          if (source_url.startsWith('/')) source_url = base + source_url;

          const image_url = imgEl?.src || imgEl?.dataset?.src || '';
          const ratingMatch = (ratingEl?.innerText || '').match(/\d+(?:\.\d+)?/);
          const rating = ratingMatch ? parseFloat(ratingMatch[0]) : null;

          return { title, price, source_url, image_url, rating };
        });
    }, BASE_URL);

    const results = raw
      .filter((item) => item.title && item.price > 0)
      .map((item) => ({
        name: item.title,
        price: item.price,
        image_url: item.image_url,
        source_url: item.source_url,
        store_name: STORE_NAME,
        rating: item.rating,
        scraped_at: new Date().toISOString(),
      }));

    logger.info(`[${STORE_NAME}] "${query}" → ${results.length} results`);
    return results;
  } catch (err) {
    logger.error(`[${STORE_NAME}] scrape error: ${err.message}`);
    return [];
  } finally {
    await page.close().catch(() => {});
  }
}

module.exports = { scrape };
