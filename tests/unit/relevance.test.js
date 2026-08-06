const { filterRelevant, queryTokens } = require('../../src/scrapers/utils/relevance');

const items = (names) => names.map((name) => ({ name, price: 100 }));
const names = (result) => result.map((i) => i.name);

describe('filterRelevant — "iphone 15 pro max"', () => {
  const q = 'iphone 15 pro max';

  test('keeps the real product (with extra spec tokens)', () => {
    const out = filterRelevant(items(['Apple iPhone 15 Pro Max 256GB']), q);
    expect(names(out)).toEqual(['Apple iPhone 15 Pro Max 256GB']);
  });

  test('drops base model missing pro/max tokens', () => {
    expect(filterRelevant(items(['Apple iPhone 15']), q)).toHaveLength(0);
    expect(filterRelevant(items(['iPhone 15 Pro']), q)).toHaveLength(0); // missing "max"
  });

  test('drops wrong model number (17 not 15)', () => {
    expect(filterRelevant(items(['iPhone 17 Pro Max']), q)).toHaveLength(0);
  });

  test('all-tokens is strict: a title missing any query token is dropped', () => {
    // Precision tradeoff: "iPhone 15 Pro" (missing "max") must NOT leak as a Pro Max...
    expect(filterRelevant(items(['iPhone 15 Pro']), q)).toHaveLength(0);
    // ...and the cost is that a brand-word-less "15 Pro Max" is also dropped. Accepted:
    // real store titles include the brand, and leaking wrong variants is the actual bug.
    expect(filterRelevant(items(['15 Pro Max 256GB Titanium']), q)).toHaveLength(0);
  });

  test('drops accessories the query did not ask for', () => {
    const junk = ['Cover for iPhone 17 Pro Max', 'iPhone 15 Pro Max Case', 'iPhone 15 Pro Max Tempered Glass'];
    expect(filterRelevant(items(junk), q)).toHaveLength(0);
  });

  test('filters a realistic mixed result set down to matches only', () => {
    const mixed = items([
      'Apple iPhone 15 Pro Max 256GB Natural Titanium', // keep
      'iPhone 15',                                       // drop (base)
      'Cover 17 Pro Max',                                // drop (accessory + wrong model)
      'iPhone 15 Pro Max Silicone Case',                 // drop (accessory)
      'Apple iPhone 15 Pro Max 512GB',                   // keep
    ]);
    expect(names(filterRelevant(mixed, q))).toEqual([
      'Apple iPhone 15 Pro Max 256GB Natural Titanium',
      'Apple iPhone 15 Pro Max 512GB',
    ]);
  });
});

describe('filterRelevant — edge cases', () => {
  test('accessory query still returns accessories (does not self-reject)', () => {
    const out = filterRelevant(items(['iPhone 15 Pro Max Silicone Case']), 'iphone 15 pro max case');
    expect(out).toHaveLength(1);
  });

  test('stopwords are not required in the title', () => {
    expect(queryTokens('the new samsung galaxy s24')).toEqual(['samsung', 'galaxy', 's24']);
    expect(filterRelevant(items(['Samsung Galaxy S24 Ultra 5G']), 'the new samsung galaxy s24')).toHaveLength(1);
  });

  test('empty / no-op inputs pass through unfiltered', () => {
    expect(filterRelevant([], 'anything')).toEqual([]);
    const one = items(['whatever']);
    expect(filterRelevant(one, '')).toBe(one);
  });
});
