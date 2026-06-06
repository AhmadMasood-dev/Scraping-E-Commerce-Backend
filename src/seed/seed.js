const City = require('../models/City');
const Store = require('../models/Store');
const logger = require('../config/logger');

const CITIES = [
  { name_en: 'islamabad', name_ur: 'اسلام آباد', province: 'Federal', aliases: ['isb', 'islamabad'] },
  { name_en: 'karachi', name_ur: 'کراچی', province: 'Sindh', aliases: ['khi', 'karachi'] },
  { name_en: 'lahore', name_ur: 'لاہور', province: 'Punjab', aliases: ['lhr', 'lahore'] },
  { name_en: 'rawalpindi', name_ur: 'راولپنڈی', province: 'Punjab', aliases: ['pindi', 'rawalpindi'] },
  { name_en: 'faisalabad', name_ur: 'فیصل آباد', province: 'Punjab', aliases: ['faisalabad', 'lyallpur'] },
  { name_en: 'peshawar', name_ur: 'پشاور', province: 'KPK', aliases: ['peshawar', 'psh'] },
  { name_en: 'quetta', name_ur: 'کوئٹہ', province: 'Balochistan', aliases: ['quetta'] },
  { name_en: 'multan', name_ur: 'ملتان', province: 'Punjab', aliases: ['multan'] },
  { name_en: 'hyderabad', name_ur: 'حیدرآباد', province: 'Sindh', aliases: ['hyderabad'] },
];

const STORES = [
  {
    name: 'Daraz',
    category: 'A',
    tier: 1,
    base_url: 'https://www.daraz.pk',
    cities_served: ['*'],
    has_online_store: true,
    scraper_type: 'api',
  },
  {
    name: 'Telemart',
    category: 'A',
    tier: 2,
    base_url: 'https://www.telemart.pk',
    cities_served: ['*'],
    has_online_store: true,
    scraper_type: 'puppeteer',
  },
  {
    name: 'PriceOye',
    category: 'B',
    tier: 2,
    base_url: 'https://priceoye.pk',
    cities_served: ['*'],
    has_online_store: true,
    scraper_type: 'puppeteer',
  },
  {
    name: 'PakWheels',
    category: 'B',
    tier: 2,
    base_url: 'https://www.pakwheels.com',
    cities_served: ['*'],
    has_online_store: true,
    scraper_type: 'puppeteer',
  },
  {
    name: 'Pakfan',
    category: 'C',
    tier: 3,
    base_url: 'https://www.pakfan.com',
    cities_served: ['*'],
    has_online_store: true,
    scraper_type: 'cheerio',
  },
  {
    name: 'Metro',
    category: 'A',
    tier: 1,
    base_url: 'https://www.metro-online.pk',
    cities_served: ['karachi', 'lahore', 'islamabad', 'rawalpindi', 'faisalabad'],
    has_online_store: true, // verified at runtime by storeHealthChecker, not hardcoded
    scraper_type: 'puppeteer',
  },
];

async function seedDatabase() {
  const cityCount = await City.countDocuments();
  if (cityCount === 0) {
    await City.insertMany(CITIES);
    logger.info(`[Seed] Inserted ${CITIES.length} cities`);
  }

  const storeCount = await Store.countDocuments();
  if (storeCount === 0) {
    await Store.insertMany(STORES);
    logger.info(`[Seed] Inserted ${STORES.length} stores`);
  }
}

module.exports = { seedDatabase };
