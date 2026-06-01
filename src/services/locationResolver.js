const City = require('../models/City');
const Store = require('../models/Store');
const logger = require('../config/logger');

const DEFAULT_CITY = 'islamabad';

async function resolveCity(cityInput) {
  if (!cityInput) cityInput = DEFAULT_CITY;
  const normalized = cityInput.toLowerCase().trim();

  const city = await City.findOne({
    $or: [{ name_en: normalized }, { aliases: normalized }],
  });

  if (!city) {
    logger.warn(`[LocationResolver] Unknown city "${cityInput}", defaulting to ${DEFAULT_CITY}`);
    return City.findOne({ name_en: DEFAULT_CITY });
  }
  return city;
}

// Return all stores that:
// 1. have online presence
// 2. serve the given city (either '*' nationwide or city listed)
async function getEligibleStores(cityInput) {
  const city = await resolveCity(cityInput);
  if (!city) {
    logger.warn('[LocationResolver] No city found at all — returning all nationwide stores');
    return Store.find({ has_online_store: true, cities_served: '*' });
  }

  const stores = await Store.find({
    has_online_store: true,
    $or: [
      { cities_served: '*' },
      { cities_served: city.name_en },
    ],
  });

  logger.info(`[LocationResolver] City: ${city.name_en} → ${stores.length} eligible stores`);
  return stores;
}

module.exports = { resolveCity, getEligibleStores, DEFAULT_CITY };
