// Mock Gemini SDK so no API key or quota is needed in tests
jest.mock('@google/generative-ai');

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { classifyProducts } = require('../../src/services/geminiClassifier');

const MOCK_CLASSIFIED = [
  {
    category: 'A',
    name_en: 'Samsung Galaxy S24',
    name_ur: 'سام سنگ گیلکسی',
    price_pkr: 150000,
    timeframe_tag: 'fresh',
    review_score: null,
    review_source: null,
    confidence: 0.95,
    image_url: 'https://example.com/img.jpg',
    source_url: 'https://www.daraz.pk/products/samsung',
  },
];

describe('GeminiClassifier', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    GoogleGenerativeAI.mockImplementation(() => ({
      getGenerativeModel: () => ({
        generateContent: async () => ({
          response: { text: () => JSON.stringify(MOCK_CLASSIFIED) },
        }),
      }),
    }));
  });

  it('returns classified array from Gemini', async () => {
    const input = [{ name: 'Samsung Galaxy S24', price: 150000, store_name: 'Daraz' }];
    const result = await classifyProducts(input);
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].name_en).toBe('Samsung Galaxy S24');
    expect(result[0].price_pkr).toBe(150000);
    expect(result[0].category).toBe('A');
  });

  it('returns empty array for empty input', async () => {
    const result = await classifyProducts([]);
    expect(result).toEqual([]);
  });

  it('falls back gracefully when Gemini errors', async () => {
    GoogleGenerativeAI.mockImplementation(() => ({
      getGenerativeModel: () => ({
        generateContent: async () => { throw new Error('API error'); },
      }),
    }));

    const input = [{ name: 'iPhone 15', price: 200000, source_url: 'https://daraz.pk/iphone', store_name: 'Daraz' }];
    const result = await classifyProducts(input);
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].name_en).toBe('iPhone 15');
    expect(result[0].confidence).toBe(0.5);
  });

  it('all results have required fields', async () => {
    const input = [{ name: 'Test Product', price: 5000, store_name: 'Daraz' }];
    const result = await classifyProducts(input);
    const fields = ['category', 'name_en', 'name_ur', 'price_pkr', 'timeframe_tag', 'confidence'];
    fields.forEach((f) => expect(result[0]).toHaveProperty(f));
  });
});
