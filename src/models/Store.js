const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, enum: ['A', 'B', 'C', 'D'], required: true },
  tier: { type: Number, enum: [1, 2, 3], required: true },
  base_url: { type: String, required: true },
  // ['*'] = nationwide, otherwise list city name_en values
  cities_served: { type: [String], default: ['*'] },
  has_online_store: { type: Boolean, default: true },
  scraper_type: { type: String, enum: ['api', 'puppeteer', 'cheerio'], required: true },
  last_checked_at: { type: Date, default: null },
}, { timestamps: true });

storeSchema.index({ category: 1 });
storeSchema.index({ has_online_store: 1 });

module.exports = mongoose.model('Store', storeSchema);
