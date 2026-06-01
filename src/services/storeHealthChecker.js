const axios = require('axios');
const { LRUCache } = require('lru-cache');
const Store = require('../models/Store');
const logger = require('../config/logger');

// Cache online status per store for 1 hour — avoids pinging on every request
const onlineCache = new LRUCache({ max: 200, ttl: 1000 * 60 * 60 });

// Quick HTTP HEAD check — just checks if the store's homepage responds
// Returns true (online) or false (offline / unreachable)
async function checkStoreOnline(store) {
  const cacheKey = store._id.toString();
  const cached = onlineCache.get(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const res = await axios.head(store.base_url, {
      timeout: 5000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
      },
      // Follow redirects (some stores redirect http → https)
      maxRedirects: 3,
      validateStatus: (status) => status < 500, // 4xx still means site exists
    });

    const online = res.status < 500;
    onlineCache.set(cacheKey, online);

    // Persist result to DB in background
    Store.findByIdAndUpdate(store._id, {
      has_online_store: online,
      last_checked_at: new Date(),
    }).catch(() => {});

    logger.info(`[HealthCheck] ${store.name} → ${online ? 'ONLINE' : 'OFFLINE'} (${res.status})`);
    return online;
  } catch (err) {
    // DNS failure, connection refused, timeout → definitely offline
    onlineCache.set(cacheKey, false);

    Store.findByIdAndUpdate(store._id, {
      has_online_store: false,
      last_checked_at: new Date(),
    }).catch(() => {});

    logger.warn(`[HealthCheck] ${store.name} → OFFLINE (${err.message})`);
    return false;
  }
}

// Check all stores in parallel — returns only the ones that are online
async function filterOnlineStores(stores) {
  const results = await Promise.allSettled(
    stores.map((store) => checkStoreOnline(store))
  );

  const online = stores.filter((_, i) => results[i].value === true);
  const offline = stores.filter((_, i) => results[i].value !== true);

  if (offline.length > 0) {
    logger.info(`[HealthCheck] Skipped offline: [${offline.map((s) => s.name).join(', ')}]`);
  }

  return online;
}

// Force-clear cache for a store (e.g., after a pipeline job confirms it's back up)
function clearCache(storeId) {
  onlineCache.delete(storeId.toString());
}

module.exports = { checkStoreOnline, filterOnlineStores, clearCache };
