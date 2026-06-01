const { newPage } = require('./browser');
const { randomUA } = require('../utils/userAgent');
const { parsePrice } = require('../utils/parsePrice');
const logger = require('../../config/logger');

const STORE_NAME = 'Telemart';
const BASE_URL = 'https://www.telemart.pk';

// Telemart uses Algolia InstantSearch SPA — product cards are <a> tags
// containing both the title text and a PKR price in plain text.
async function scrape(query) {
  const page = await newPage(randomUA());
  try {
    const url = `${BASE_URL}/search?q=${encodeURIComponent(query)}`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
    // Let Algolia SPA finish rendering
    await page.waitForSelector('a[href^="https://www.telemart.pk/"]', { timeout: 5000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 400));

    const raw = await page.evaluate((base) => {
      const seen = new Set();
      const out = [];

      const anchors = Array.from(
        document.querySelectorAll('a[href^="https://www.telemart.pk/"], a[href^="/"]')
      );

      for (const a of anchors) {
        const text = (a.innerText || '').replace(/\s+/g, ' ').trim();
        if (!text || text.length < 15) continue;

        const priceMatch = text.match(/(?:Rs|PKR|₨)\.?\s*([\d,]+)/i);
        if (!priceMatch) continue;

        // Skip navigation / UI chrome
        if (/^(Sort|Filter|Login|Sign|Categories|Home|About|Contact|Cart)/i.test(text)) continue;

        const href = a.href.startsWith('/') ? base + a.href : a.href;
        if (!href || seen.has(href)) continue;
        seen.add(href);

        const beforePrice = text.slice(0, priceMatch.index).trim();
        const title = beforePrice
          .replace(/(Add to (Cart|Wishlist)|Quick View|Compare)/gi, '')
          .trim();

        if (!title || title.length < 5) continue;

        const imgEl = a.querySelector('img') || a.parentElement?.querySelector('img');
        const image_url = imgEl?.src || imgEl?.dataset?.src || imgEl?.dataset?.original || '';

        out.push({ title, priceRaw: priceMatch[1], source_url: href, image_url });
        if (out.length >= 20) break;
      }
      return out;
    }, BASE_URL);

    const results = raw
      .map((item) => ({
        name: item.title,
        price: parsePrice(item.priceRaw),
        image_url: item.image_url,
        source_url: item.source_url,
        store_name: STORE_NAME,
        scraped_at: new Date().toISOString(),
      }))
      .filter((item) => item.price > 0);

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
