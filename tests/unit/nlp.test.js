const { processQuery, detectLanguage } = require('../../src/nlp/processor');

describe('NLP Processor', () => {
  describe('detectLanguage', () => {
    it('detects English', () => {
      expect(detectLanguage('iphone 15 pro max')).toBe('en');
    });

    it('detects native Urdu script', () => {
      expect(detectLanguage('آئی فون')).toBe('ur');
    });

    it('detects Roman Urdu', () => {
      expect(detectLanguage('mujhe naya mobile chahiye')).toBe('ro');
    });

    it('defaults to English for unknown', () => {
      expect(detectLanguage('xyz abc')).toBe('en');
    });
  });

  describe('processQuery', () => {
    it('returns correct shape for English query', async () => {
      const result = await processQuery('samsung galaxy phone');
      expect(result).toHaveProperty('original', 'samsung galaxy phone');
      expect(result).toHaveProperty('language', 'en');
      expect(result).toHaveProperty('keywords');
      expect(Array.isArray(result.keywords)).toBe(true);
      expect(result).toHaveProperty('normalized');
      expect(result).toHaveProperty('timeframe');
    });

    it('transliterates Roman Urdu', async () => {
      const result = await processQuery('naya mobile chahiye');
      expect(result.language).toBe('ro');
      expect(result.translated).toContain('new');
      expect(result.translated).not.toContain('chahiye');
    });

    it('extracts timeframe hint', async () => {
      const result = await processQuery('latest iphone 2025');
      expect(result.timeframe).toBe('fresh');
    });

    it('returns null timeframe when no hint', async () => {
      const result = await processQuery('laptop');
      expect(result.timeframe).toBeNull();
    });

    it('handles empty string gracefully', async () => {
      const result = await processQuery('');
      expect(result.keywords).toEqual([]);
    });

    it('extracts unit specifications', async () => {
      const result = await processQuery('laptop 8gb ram');
      expect(result.units).toEqual(expect.arrayContaining([{ value: 8, unit: 'gb' }]));
    });
  });
});
