jest.mock('@google/generative-ai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { scoreBlogSentiment } = require('../../src/services/sentiment');

const longText = 'This phone is excellent. '.repeat(20);

function mockGemini(responseText) {
  GoogleGenerativeAI.mockImplementation(() => ({
    getGenerativeModel: () => ({
      generateContent: async () => ({ response: { text: () => responseText } }),
    }),
  }));
}

describe('scoreBlogSentiment', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns null score for too-short text without calling Gemini', async () => {
    const result = await scoreBlogSentiment('iPhone 15', 'tiny');
    expect(result).toEqual({ score: null, summary: '' });
  });

  it('parses a clean JSON response', async () => {
    mockGemini(JSON.stringify({ score: 4.5, summary: 'Great camera, solid battery' }));
    const result = await scoreBlogSentiment('iPhone 15', longText);
    expect(result.score).toBe(4.5);
    expect(result.summary).toContain('Great camera');
  });

  it('strips markdown code fences', async () => {
    mockGemini('```json\n{"score": 3.0, "summary": "Mixed bag"}\n```');
    const result = await scoreBlogSentiment('Galaxy S24', longText);
    expect(result.score).toBe(3.0);
  });

  it('clamps score to 0–5 range', async () => {
    mockGemini(JSON.stringify({ score: 9, summary: 'over' }));
    const result = await scoreBlogSentiment('TV', longText);
    expect(result.score).toBe(5);
  });

  it('returns null score when article does not discuss product', async () => {
    mockGemini(JSON.stringify({ score: null, summary: 'unrelated' }));
    const result = await scoreBlogSentiment('Fan', longText);
    expect(result.score).toBeNull();
  });

  it('falls back gracefully when Gemini throws', async () => {
    GoogleGenerativeAI.mockImplementation(() => ({
      getGenerativeModel: () => ({
        generateContent: async () => { throw new Error('quota'); },
      }),
    }));
    const result = await scoreBlogSentiment('Laptop', longText);
    expect(result).toEqual({ score: null, summary: '' });
  });
});
