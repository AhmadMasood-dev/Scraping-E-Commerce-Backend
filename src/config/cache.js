const { LRUCache } = require('lru-cache');

const cache = new LRUCache({
  max: 500,
  ttl: 1000 * 60 * 30, // 30 minutes
});

module.exports = {
  get: (key) => cache.get(key),
  set: (key, value) => cache.set(key, value),
  del: (key) => cache.delete(key),
  clear: () => cache.clear(),
  has: (key) => cache.has(key),
};
