const { newPage } = require('./browser');
const { randomUA } = require('../utils/userAgent');
const { parsePrice } = require('../utils/parsePrice');
const logger = require('../../config/logger');

const STORE_NAME = 'PakWheels';
const BASE_URL = 'https://www.pakwheels.com';

// Car/bike keywords — PakWheels is only scraped when query matches these
const CAR_TERMS = new Set([
  'car', 'vehicle', 'auto', 'bike', 'motorcycle', 'scooter',
  'honda', 'toyota', 'suzuki', 'kia', 'hyundai', 'nissan', 'mazda',
  'mehran', 'cultus', 'alto', 'corolla', 'civic', 'city', 'wagon',
  'yaris', 'swift', 'revo', 'hilux', 'prado', 'fortuner', 'mira',
  'cd70', 'cg125', 'ybr', 'gs150', 'cb150f', 'cbr',
]);

function isCarQuery(keywords) {
  return keywords.some((kw) => CAR_TERMS.has(kw.toLowerCase()));
}

async function scrape(query, keywords = [], city = 'islamabad') {
  if (!isCarQuery(keywords)) {
    logger.info(`[${STORE_NAME}] Skipped — no vehicle terms in query`);
    return [];
  }

  const page = await newPage(randomUA());
  try {
    const cityParam = city !== 'islamabad' ? `&city=${encodeURIComponent(city)}` : '';
    const url = `${BASE_URL}/used-cars/search/-/?q=${encodeURIComponent(query)}${cityParam}`;

    await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
    await page
      .waitForSelector('.search-listing, .car-listing, .listing-item', { timeout: 6000 })
      .catch(() => {});
    await new Promise((r) => setTimeout(r, 400));

    const raw = await page.evaluate((base) => {
      const listings = document.querySelectorAll(
        '.search-listing li, .listing-item, article.car-item'
      );
      return Array.from(listings)
        .slice(0, 20)
        .map((el) => {
          const titleEl = el.querySelector('.car-name a, h3 a, .listing-title a, a.car-name');
          const priceEl = el.querySelector('.price-details strong, .price-box, [class*="price"]');
          const imgEl = el.querySelector('img');
          const linkEl = titleEl?.closest('a') || el.querySelector('a[href*="/cars/"]');
          const metaEl = el.querySelector('.listing-meta, .car-specs, .specs-list');

          const title = (titleEl?.innerText || titleEl?.textContent || '').trim();
          const priceText = (priceEl?.innerText || '').replace(/[^\d]/g, '');
          const price = priceText ? parseInt(priceText, 10) : 0;

          let source_url = linkEl?.href || titleEl?.href || '';
          if (source_url.startsWith('/')) source_url = base + source_url;

          const image_url = imgEl?.src || imgEl?.dataset?.src || '';
          const meta = (metaEl?.innerText || '').replace(/\s+/g, ' ').trim();

          return { title, price, source_url, image_url, meta };
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
        description: item.meta,
        scraped_at: new Date().toISOString(),
      }));

    logger.info(`[${STORE_NAME}] "${query}" (city: ${city}) → ${results.length} results`);
    return results;
  } catch (err) {
    logger.error(`[${STORE_NAME}] scrape error: ${err.message}`);
    return [];
  } finally {
    await page.close().catch(() => {});
  }
}

module.exports = { scrape, isCarQuery };
