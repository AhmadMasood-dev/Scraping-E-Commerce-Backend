const City = require('../models/City');
const Store = require('../models/Store');
const logger = require('../config/logger');

const CITIES = [
  { name_en: 'islamabad', name_ur: 'اسلام آباد', province: 'Federal', aliases: ['isb', 'islamabad'], lat: 33.6844, lng: 73.0479 },
  { name_en: 'karachi', name_ur: 'کراچی', province: 'Sindh', aliases: ['khi', 'karachi'], lat: 24.8607, lng: 67.0011 },
  { name_en: 'lahore', name_ur: 'لاہور', province: 'Punjab', aliases: ['lhr', 'lahore'], lat: 31.5204, lng: 74.3587 },
  { name_en: 'rawalpindi', name_ur: 'راولپنڈی', province: 'Punjab', aliases: ['pindi', 'rawalpindi'], lat: 33.5651, lng: 73.0169 },
  { name_en: 'faisalabad', name_ur: 'فیصل آباد', province: 'Punjab', aliases: ['faisalabad', 'lyallpur'], lat: 31.4504, lng: 73.1350 },
  { name_en: 'peshawar', name_ur: 'پشاور', province: 'KPK', aliases: ['peshawar', 'psh'], lat: 34.0151, lng: 71.5249 },
  { name_en: 'quetta', name_ur: 'کوئٹہ', province: 'Balochistan', aliases: ['quetta'], lat: 30.1798, lng: 66.9750 },
  { name_en: 'multan', name_ur: 'ملتان', province: 'Punjab', aliases: ['multan'], lat: 30.1575, lng: 71.5249 },
  { name_en: 'hyderabad', name_ur: 'حیدرآباد', province: 'Sindh', aliases: ['hyderabad'], lat: 25.3960, lng: 68.3578 },
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
    name: 'Shophive',
    category: 'C',
    tier: 3,
    base_url: 'https://www.shophive.com',
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
  // Upsert cities by name so coords (lat/lng) backfill onto existing docs.
  for (const c of CITIES) {
    await City.updateOne({ name_en: c.name_en }, { $set: c }, { upsert: true });
  }

  // Upsert by name so newly-added stores appear without wiping the collection.
  // Only sets curated fields on insert; preserves runtime health fields
  // (has_online_store, last_checked_at) on existing docs.
  let added = 0;
  for (const s of STORES) {
    const r = await Store.updateOne(
      { name: s.name },
      { $setOnInsert: s },
      { upsert: true }
    );
    if (r.upsertedCount) added++;
  }
  if (added) logger.info(`[Seed] Added ${added} new store(s)`);
}

module.exports = { seedDatabase };
