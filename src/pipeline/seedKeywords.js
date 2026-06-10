// Curated keyword list the background pipeline refreshes every cycle.
// These pre-warm the DB so common searches hit cache instead of live-scraping.
// Grouped by category for readability; the pipeline flattens them.
const SEED_KEYWORDS = {
  electronics: [
    'iphone', 'samsung galaxy', 'laptop', 'led tv', 'smart watch',
    'earbuds', 'power bank', 'gaming mouse',
  ],
  appliances: [
    'air conditioner', 'refrigerator', 'washing machine',
    'microwave oven', 'ceiling fan', 'water dispenser',
  ],
  grocery: ['rice', 'cooking oil', 'tea', 'flour', 'sugar'],
  fashion: ['shoes', 'watch', 'sunglasses', 'backpack'],
  vehicles: ['honda civic', 'suzuki mehran', 'toyota corolla', 'honda cd70'],
};

// Flat list of every keyword (used by the full-refresh worker)
function allKeywords() {
  return Object.values(SEED_KEYWORDS).flat();
}

module.exports = { SEED_KEYWORDS, allKeywords };
