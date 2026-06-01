const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  source: { type: String, enum: ['user_review', 'blog_sentiment'], required: true },
  score: { type: Number, min: 0, max: 5, required: true },
  review_text: { type: String, default: '' },
  review_date: { type: Date, required: true },
  timeframe_weight: { type: Number, default: 1.0 }, // 1.0 / 0.7 / 0.4
  blog_url: { type: String, default: '' },
  within_timeframe: { type: Boolean, default: true }, // false if > 18 months
}, { timestamps: true });

reviewSchema.index({ product_id: 1, source: 1 });

module.exports = mongoose.model('Review', reviewSchema);
