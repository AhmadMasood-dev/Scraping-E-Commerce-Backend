const logger = require('../../config/logger');

// Wraps any async function with a hard timeout.
// On timeout: logs a warning and returns the fallback value (default []).
async function withTimeout(fn, ms, storeName, fallback = []) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${storeName} timed out after ${ms}ms`)), ms);
  });
  try {
    const result = await Promise.race([fn(), timeout]);
    return result;
  } catch (err) {
    logger.warn(`[${storeName}] ${err.message}`);
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { withTimeout };
