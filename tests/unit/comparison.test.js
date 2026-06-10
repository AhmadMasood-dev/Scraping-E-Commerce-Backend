const { diceSimilarity, group } = require('../../src/scrapers/utils/productMatcher');
const { buildComparison } = require('../../src/services/comparison');

const store = (name) => ({ _id: { toString: () => name }, name });
const item = (name_en, storeName, price, extra = {}) => ({
  name_en,
  price_pkr: price,
  source_url: `https://${storeName}.pk/${name_en.replace(/\s+/g, '-')}`,
  image_url: `img-${storeName}`,
  _storeDoc: store(storeName),
  ...extra,
});

describe('diceSimilarity', () => {
  it('identical strings → 1', () => expect(diceSimilarity('iPhone 15', 'iPhone 15')).toBe(1));
  it('near-identical → high', () => expect(diceSimilarity('Apple iPhone 15 128GB', 'iPhone 15 128 GB Apple')).toBeGreaterThan(0.6));
  it('different products → low', () => expect(diceSimilarity('iPhone 15', 'Samsung TV')).toBeLessThan(0.4));
  it('empty → 0', () => expect(diceSimilarity('', 'x')).toBe(0));
});

describe('group', () => {
  it('clusters similar titles across stores', () => {
    const items = [
      item('Apple iPhone 15 128GB', 'daraz', 280000),
      item('iPhone 15 128GB Apple', 'priceoye', 275000),
      item('Samsung Galaxy S24', 'daraz', 250000),
    ];
    const groups = group(items, 'name_en');
    expect(groups.length).toBe(2); // iPhone cluster + Samsung
    const iphoneCluster = groups.find((g) => g.length === 2);
    expect(iphoneCluster).toBeDefined();
  });
});

describe('buildComparison', () => {
  it('returns null primary for empty input', () => {
    expect(buildComparison([])).toEqual({ primary: null, storeResults: [] });
  });

  it('builds a cross-store comparison sorted cheapest-first with savings', () => {
    const items = [
      item('Apple iPhone 15 128GB', 'daraz', 280000),
      item('iPhone 15 128GB Apple', 'priceoye', 275000),
      item('Apple iPhone 15 - 128 GB', 'shophive', 290000),
    ];
    const { primary } = buildComparison(items);
    expect(primary).not.toBeNull();
    expect(primary.has_comparison).toBe(true);
    expect(primary.comparisons[0].price_pkr).toBe(275000); // cheapest first
    expect(primary.cheapest_store).toBe('priceoye');
    expect(primary.savings).toBe(290000 - 275000);
  });

  it('storeResults has cheapest item per store', () => {
    const items = [
      item('iPhone 15', 'daraz', 280000),
      item('iPhone 15 Pro', 'daraz', 350000),
      item('iPhone 15', 'priceoye', 275000),
    ];
    const { storeResults } = buildComparison(items);
    const daraz = storeResults.find((s) => s.store_name === 'daraz');
    expect(daraz.price_pkr).toBe(280000); // cheaper of the two Daraz items
    expect(storeResults.length).toBe(2);
  });

  it('single-store result → has_comparison false', () => {
    const { primary } = buildComparison([item('Lonely Product', 'daraz', 1000)]);
    expect(primary.has_comparison).toBe(false);
    expect(primary.savings).toBe(0);
  });

  it('ignores items with no price', () => {
    const items = [item('iPhone 15', 'daraz', 0), item('iPhone 15', 'priceoye', 275000)];
    const { storeResults } = buildComparison(items);
    expect(storeResults.length).toBe(1);
    expect(storeResults[0].store_name).toBe('priceoye');
  });
});
