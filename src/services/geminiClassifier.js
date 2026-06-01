const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../config/logger');

function getClient() {
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

// Generic framework prompt — same for ALL store categories (A/B/C/D)
// Only the input data changes. Gemini handles classification automatically.
const SYSTEM_PROMPT = `You are a product data normalisation engine for a Pakistani e-commerce comparison app.

Given a list of raw product objects (scraped from various Pakistani online stores), return a JSON array where each element has EXACTLY these fields:
- category: "A" (generic marketplace) | "B" (niche/comparison) | "C" (brand/niche store) — infer from store_name
- name_en: clean English product name (remove store names, codes, special chars)
- name_ur: Urdu translation or phonetic transliteration of the product name
- brand: manufacturer/brand extracted from the product name (e.g. "Samsung", "Apple", "Honda", "Nestle") — empty string "" if no recognisable brand
- price_pkr: integer price in Pakistani Rupees (extract number only, no commas/symbols)
- timeframe_tag: "fresh" (product added/updated < 30 days) | "recent" (< 6 months) | "old" (> 6 months) — infer from scraped_at date if available, else "fresh"
- review_score: null (no reviews in this batch — Review Engine handles this separately)
- review_source: null
- confidence: 0.0 to 1.0 (how confident you are in the classification — flag unclear products < 0.80)
- image_url: pass through from input unchanged
- source_url: pass through from input unchanged

Rules:
- For brand: extract only a real manufacturer/brand name from the product title; if unclear, use ""
- If price cannot be determined, set price_pkr to 0 and confidence to 0.5
- For brand stores (Samsung, Honda, Pakfan), set category to "C"
- For PriceOye / PakWheels, set category to "B"
- For Daraz, OLX, Telemart, Metro, set category to "A"
- Return ONLY valid JSON array — no markdown, no prose, no code blocks`;

async function classifyProducts(rawProducts) {
  if (!rawProducts || rawProducts.length === 0) return [];

  try {
    const model = getClient().getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `${SYSTEM_PROMPT}\n\nInput products:\n${JSON.stringify(rawProducts, null, 2)}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Strip markdown code blocks if Gemini wraps output
    const cleaned = text.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
    const classified = JSON.parse(cleaned);

    if (!Array.isArray(classified)) throw new Error('Gemini returned non-array');

    const flagged = classified.filter((p) => p.confidence < 0.8).length;
    if (flagged > 0) logger.warn(`[Gemini] ${flagged}/${classified.length} products flagged (confidence < 0.80)`);

    return classified;
  } catch (err) {
    logger.error(`[Gemini] Classification error: ${err.message}`);
    // Passthrough fallback — return raw products with default fields so search doesn't fail
    return rawProducts.map((p) => ({
      category: 'A',
      name_en: p.name || p.title || 'Unknown Product',
      name_ur: '',
      brand: p.brand || '',
      price_pkr: typeof p.price === 'number' ? p.price : 0,
      timeframe_tag: 'fresh',
      review_score: null,
      review_source: null,
      confidence: 0.5,
      image_url: p.image_url || p.image || '',
      source_url: p.source_url || p.url || '',
    }));
  }
}

module.exports = { classifyProducts };
