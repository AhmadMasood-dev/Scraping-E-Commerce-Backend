const mongoose = require('mongoose');

const priceHistorySchema = new mongoose.Schema({
  price_pkr: Number,
  recorded_at: { type: Date, default: Date.now },
}, { _id: false });

const productSchema = new mongoose.Schema({
  name_en: { type: String, required: true },
  name_ur: { type: String, default: '' },
  brand: { type: String, default: '' },
  store_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', required: true },
  category: { type: String, enum: ['A', 'B', 'C', 'D'], required: true },
  price_pkr: { type: Number, required: true },
  source_url: { type: String, required: true }, // product page on store
  image_url: { type: String, default: '' },     // product thumbnail
  rating: { type: Number, default: null },       // store's own scraped rating (0–5), distinct from aggregated review_score
  timeframe_tag: { type: String, enum: ['fresh', 'recent', 'old'], default: 'fresh' },
  confidence: { type: Number, default: 1.0 },
  flagged: { type: Boolean, default: false }, // confidence < 0.80
  price_history: [priceHistorySchema],
}, { timestamps: true });

productSchema.index({ store_id: 1, source_url: 1 }, { unique: true });
productSchema.index({ name_en: 'text' });
productSchema.index({ category: 1, price_pkr: 1 });

module.exports = mongoose.model('Product', productSchema);
