// Tests the pure extraction + parse logic — no real browser needed
const { parsePrice } = require('../../src/scrapers/utils/parsePrice');
const { isCarQuery } = require('../../src/scrapers/puppeteer/pakwheels');
const { randomUA } = require('../../src/scrapers/utils/userAgent');

describe('parsePrice', () => {
  it('parses plain integer', () => expect(parsePrice(12500)).toBe(12500));
  it('parses string with commas', () => expect(parsePrice('12,500')).toBe(12500));
  it('parses Rs. prefix', () => expect(parsePrice('Rs. 12,500')).toBe(12500));
  it('parses PKR prefix', () => expect(parsePrice('PKR 85000')).toBe(85000));
  it('parses float and rounds', () => expect(parsePrice('12500.99')).toBe(12501));
  it('returns 0 for null', () => expect(parsePrice(null)).toBe(0));
  it('returns 0 for undefined', () => expect(parsePrice(undefined)).toBe(0));
  it('returns 0 for non-numeric string', () => expect(parsePrice('N/A')).toBe(0));
  it('parses price with currency symbol ₨', () => expect(parsePrice('₨12,000')).toBe(12000));
});

describe('isCarQuery (PakWheels gate)', () => {
  it('returns true for "honda civic"', () => expect(isCarQuery(['honda', 'civic'])).toBe(true));
  it('returns true for "car"', () => expect(isCarQuery(['used', 'car'])).toBe(true));
  it('returns true for "bike"', () => expect(isCarQuery(['bike', '150cc'])).toBe(true));
  it('returns false for "iphone"', () => expect(isCarQuery(['iphone', '15', 'pro'])).toBe(false));
  it('returns false for "laptop"', () => expect(isCarQuery(['laptop', 'dell'])).toBe(false));
  it('returns false for empty keywords', () => expect(isCarQuery([])).toBe(false));
  it('is case-insensitive', () => expect(isCarQuery(['HONDA', 'City'])).toBe(true));
});

describe('randomUA', () => {
  it('returns a non-empty string', () => {
    const ua = randomUA();
    expect(typeof ua).toBe('string');
    expect(ua.length).toBeGreaterThan(10);
  });

  it('returns different UAs across calls (randomness check)', () => {
    const seen = new Set();
    for (let i = 0; i < 20; i++) seen.add(randomUA());
    expect(seen.size).toBeGreaterThan(1);
  });
});
