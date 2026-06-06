const axios = require('axios');
const logger = require('../../config/logger');

// Uses Daraz public search endpoint (no auth required for public search)
// When you have App Key + App Secret from open.daraz.com,
// replace this with the authenticated Open Platform endpoint.
const DARAZ_SEARCH_URL = 'https://www.daraz.pk/catalog/?ajax=true&isFirstRequest=true&page=1';

async function searchDaraz(query, maxResults = 20) {
  try {
    const url = `${DARAZ_SEARCH_URL}&q=${encodeURIComponent(query)}`;
    const { data } = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://www.daraz.pk/',
      },
      timeout: 15000,
    });

    const items = data?.mods?.listItems || [];
    const results = items.slice(0, maxResults).map((item) => ({
      name: item.name || item.brandName || 'Unknown',
      price: parsePrice(item.price || item.priceShow),
      image_url: normalizeUrl(item.image),
      // Daraz field is `itemUrl` (often protocol-relative: //www.daraz.pk/...)
      source_url: normalizeUrl(item.itemUrl || item.productUrl),
      store_name: 'Daraz',
      rating: parseFloat(item.ratingScore) || null,
      scraped_at: new Date().toISOString(),
    }));

    logger.info(`[Daraz] "${query}" → ${results.length} results`);
    return results;
  } catch (err) {
    logger.error(`[Daraz] Search error for "${query}": ${err.message}`);
    return [];
  }
}

function parsePrice(raw) {
  if (!raw) return 0;
  const n = parseFloat(String(raw).replace(/[^0-9.]/g, ''));
  return isNaN(n) ? 0 : Math.round(n);
}

// Normalises Daraz URLs: protocol-relative (//host/...) → https://, relative (/...) → daraz.pk
function normalizeUrl(url) {
  if (!url) return '';
  if (url.startsWith('//')) return `https:${url}`;
  if (url.startsWith('/')) return `https://www.daraz.pk${url}`;
  return url;
}

module.exports = { searchDaraz, normalizeUrl };
