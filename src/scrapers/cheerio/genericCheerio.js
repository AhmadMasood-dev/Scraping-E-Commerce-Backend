const axios = require('axios');
const cheerio = require('cheerio');
const { randomUA } = require('../utils/userAgent');
const { parsePrice } = require('../utils/parsePrice');
const logger = require('../../config/logger');

// One reusable Cheerio scraper for static-HTML brand/niche stores (Category C).
// Each store supplies a config of CSS selectors — no per-store code needed.

// ── Pure parser (unit-testable with fixture HTML) ────────────────────────────
// config.selectors: { card, title, price, link, image }
function parseProducts(html, config, limit = 20) {
  const { baseUrl, selectors } = config;
  const $ = cheerio.load(html);
  const out = [];
  const seen = new Set();

  $(selectors.card).each((_, el) => {
    if (out.length >= limit) return;
    const card = $(el);

    const title = card.find(selectors.title).first().text().replace(/\s+/g, ' ').trim();
    const priceText = card.find(selectors.price).first().text().trim();
    const price = parsePrice(priceText);

    const linkEl = card.find(selectors.link).first();
    let url = linkEl.attr('href') || '';
    if (url.startsWith('/')) url = baseUrl.replace(/\/$/, '') + url;

    const imgEl = card.find(selectors.image).first();
    const image_url = imgEl.attr('src') || imgEl.attr('data-src') || imgEl.attr('data-original') || '';

    if (!title || price <= 0 || !url || seen.has(url)) return;
    seen.add(url);

    out.push({ name: title, price, source_url: url, image_url });
  });

  return out;
}

// ── Network layer ────────────────────────────────────────────────────────────
function createCheerioScraper(config) {
  const { name, baseUrl, searchPath } = config;

  async function scrape(query, limit = 20) {
    try {
      const url = baseUrl.replace(/\/$/, '') + searchPath(query);
      const { data } = await axios.get(url, {
        headers: { 'User-Agent': randomUA(), Accept: 'text/html' },
        timeout: 12000,
        maxRedirects: 3,
      });
      const items = parseProducts(data, config, limit).map((it) => ({
        ...it,
        store_name: name,
        scraped_at: new Date().toISOString(),
      }));
      logger.info(`[Cheerio:${name}] "${query}" → ${items.length} results`);
      return items;
    } catch (err) {
      logger.warn(`[Cheerio:${name}] scrape failed: ${err.message}`);
      return [];
    }
  }

  return { name, scrape };
}

module.exports = { parseProducts, createCheerioScraper };
