const { createCheerioScraper } = require('./genericCheerio');
const { withTimeout } = require('../utils/withTimeout');
const logger = require('../../config/logger');

// Category C brand/niche store configs. Adding a new store = add a config here.
// Pakfan stays configured but is auto-skipped while its site is unreachable
// (the health checker handles that — no code change needed when it comes back).
const CONFIGS = {
  Shophive: {
    name: 'Shophive',
    baseUrl: 'https://www.shophive.com',
    searchPath: (q) => `/catalogsearch/result/?q=${encodeURIComponent(q)}`,
    selectors: {
      card: 'li.item.product, .product-item',
      title: '.product-item-link, .product-name a, a.product-item-link',
      price: '.price, .special-price .price, [data-price-type="finalPrice"]',
      link: '.product-item-link, a.product-item-photo',
      image: 'img.product-image-photo, img',
    },
  },
  Pakfan: {
    name: 'Pakfan',
    baseUrl: 'https://www.pakfan.com',
    searchPath: (q) => `/?s=${encodeURIComponent(q)}&post_type=product`,
    selectors: {
      card: 'li.product, .product',
      title: '.woocommerce-loop-product__title, h2 a, .product-title',
      price: '.price .amount, .price, bdi',
      link: 'a.woocommerce-LoopProduct-link, a',
      image: 'img',
    },
  },
};

const SCRAPERS = Object.fromEntries(
  Object.entries(CONFIGS).map(([name, cfg]) => [name, createCheerioScraper(cfg)])
);

// Scrape a Category C store by name. Returns [] if no config or on failure.
async function scrapeCheerio(storeName, query) {
  const scraper = SCRAPERS[storeName];
  if (!scraper) {
    logger.info(`[Cheerio] No config for store "${storeName}"`);
    return [];
  }
  return withTimeout(() => scraper.scrape(query), 15000, `Cheerio:${storeName}`);
}

module.exports = { scrapeCheerio, CONFIGS, SCRAPERS };
