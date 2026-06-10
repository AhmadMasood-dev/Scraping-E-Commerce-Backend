const mongoose = require('mongoose');

const citySchema = new mongoose.Schema({
  name_en: { type: String, required: true, lowercase: true },
  name_ur: { type: String, default: '' },
  province: { type: String, default: '' },
  aliases: [{ type: String, lowercase: true }], // alternate spellings
  lat: { type: Number, default: null }, // for geolocation → nearest-city
  lng: { type: Number, default: null },
}, { timestamps: true });

citySchema.index({ name_en: 1 });
citySchema.index({ aliases: 1 });

module.exports = mongoose.model('City', citySchema);
