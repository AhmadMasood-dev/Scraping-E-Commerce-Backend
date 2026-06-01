const mongoose = require('mongoose');

const citySchema = new mongoose.Schema({
  name_en: { type: String, required: true, lowercase: true },
  name_ur: { type: String, default: '' },
  province: { type: String, default: '' },
  aliases: [{ type: String, lowercase: true }], // alternate spellings
}, { timestamps: true });

citySchema.index({ name_en: 1 });
citySchema.index({ aliases: 1 });

module.exports = mongoose.model('City', citySchema);
