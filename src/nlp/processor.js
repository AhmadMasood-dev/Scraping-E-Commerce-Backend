const compromise = require('compromise');
const logger = require('../config/logger');

const romanUrduDict = {
  // intent fillers — dropped
  mujhe: '', mujhay: '', chahiye: '', chahye: '', chahyee: '',
  hai: '', hay: '', ka: '', ki: '', ke: '', ko: '', se: '', mein: '', kuch: '',
  // adjectives
  sasta: 'cheap', sastay: 'cheap', sasti: 'cheap',
  mehnga: 'expensive', mehngi: 'expensive',
  acha: 'good', achi: 'good', achay: 'good',
  bura: 'bad', buri: 'bad',
  naya: 'new', nai: 'new', nayi: 'new',
  purana: 'old', purani: 'old',
  bara: 'big', bari: 'big',
  chota: 'small', choti: 'small',
  // nouns
  mobile: 'smartphone', mobail: 'smartphone', phone: 'smartphone',
  laptop: 'laptop', computer: 'computer',
  joota: 'shoes', jootay: 'shoes', jootian: 'shoes',
  kapde: 'clothes', kapra: 'clothes', kapray: 'clothes',
  ghari: 'watch', gharian: 'watches',
  ghar: 'house', makaan: 'house',
  gari: 'car', gaari: 'car',
  chai: 'tea', cheeni: 'sugar', doodh: 'milk',
  pani: 'water', tel: 'oil',
  // timeframe hints
  naya: 'new', latest: 'latest', purana: 'old',
};

const ROMAN_URDU_HINTS = new Set([
  'mujhe', 'chahiye', 'chahye', 'sasta', 'mehnga', 'acha', 'naya', 'kapde',
  'joota', 'ghari', 'mobail', 'gari', 'cheeni', 'doodh', 'pani', 'ghar',
]);

const URDU_RANGE = /[؀-ۿ]/;

// Timeframe keywords → used to tag queries with recency intent
const TIMEFRAME_PATTERNS = [
  { pattern: /\b(latest|new|2024|2025|2026)\b/i, tag: 'fresh' },
  { pattern: /\b(recent|this year)\b/i, tag: 'recent' },
  { pattern: /\b(old|older|2023|2022|2021)\b/i, tag: 'old' },
];

function detectLanguage(text) {
  if (URDU_RANGE.test(text)) return 'ur';
  const tokens = text.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = tokens.filter((t) => ROMAN_URDU_HINTS.has(t)).length;
  if (hits >= 1 && tokens.length <= 8) return 'ro';
  try {
    const { franc } = require('franc-min');
    const code = franc(text, { minLength: 4 });
    if (code === 'urd') return 'ur';
  } catch (_e) {}
  return 'en';
}

function transliterateRoman(text) {
  return text
    .split(/\s+/)
    .map((w) => {
      const k = w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
      return romanUrduDict[k] !== undefined ? romanUrduDict[k] : w;
    })
    .filter((w) => w !== '')
    .join(' ')
    .trim();
}

// Gemini handles Urdu script translation — this is the free local fallback
function transliterateUrduFallback(text) {
  return transliterateRoman(text);
}

function extractKeywords(englishText) {
  try {
    const doc = compromise(englishText);
    const nouns = doc.nouns().out('array');
    const adjectives = doc.adjectives().out('array');
    const merged = [...new Set([...nouns, ...adjectives].map((w) => w.toLowerCase()).filter(Boolean))];
    return merged.length > 0 ? merged : englishText.toLowerCase().split(/\s+/).filter(Boolean);
  } catch (_e) {
    return englishText.toLowerCase().split(/\s+/).filter(Boolean);
  }
}

function extractTimeframe(text) {
  for (const { pattern, tag } of TIMEFRAME_PATTERNS) {
    if (pattern.test(text)) return tag;
  }
  return null; // no timeframe hint in query
}

// Longer units must come before shorter prefixes (gb before g, tb before t, mb before m)
const UNIT_REGEX = /(\d+(?:\.\d+)?)\s*(gb|tb|mb|kg|ml|inch|in|g|l)/gi;
function extractUnits(text) {
  const out = [];
  let m;
  UNIT_REGEX.lastIndex = 0;
  while ((m = UNIT_REGEX.exec(text)) !== null) {
    out.push({ value: parseFloat(m[1]), unit: m[2].toLowerCase() });
  }
  return out;
}

async function processQuery(raw, langHint) {
  const original = (raw || '').trim();
  if (!original) return { original, language: 'en', translated: '', keywords: [], units: [], normalized: '', timeframe: null };

  const language = langHint || detectLanguage(original);

  let translated = original;
  if (language === 'ro') {
    translated = transliterateRoman(original);
  } else if (language === 'ur') {
    // Urdu script — local fallback (Gemini handles proper translation in classifier)
    translated = transliterateUrduFallback(original);
    logger.info(`[NLP] Urdu fallback transliteration: "${original}" → "${translated}"`);
  }

  const keywords = extractKeywords(translated);
  const units = extractUnits(translated);
  const timeframe = extractTimeframe(original);
  const normalized = (keywords.join(' ') || translated).toLowerCase().trim();

  return { original, language, translated, keywords, units, normalized, timeframe };
}

module.exports = { processQuery, detectLanguage };
