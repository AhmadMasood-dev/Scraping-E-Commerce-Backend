const { dedupeItems } = require('../../src/pipeline/normaliser');

const store = (id) => ({ _id: { toString: () => id } });

describe('dedupeItems', () => {
  it('removes exact (store + source_url) duplicates', () => {
    const items = [
      { source_url: 'https://daraz.pk/p1', _storeDoc: store('s1') },
      { source_url: 'https://daraz.pk/p1', _storeDoc: store('s1') },
      { source_url: 'https://daraz.pk/p2', _storeDoc: store('s1') },
    ];
    expect(dedupeItems(items).length).toBe(2);
  });

  it('keeps same URL from different stores (not a duplicate)', () => {
    const items = [
      { source_url: 'https://x.pk/p1', _storeDoc: store('s1') },
      { source_url: 'https://x.pk/p1', _storeDoc: store('s2') },
    ];
    expect(dedupeItems(items).length).toBe(2);
  });

  it('drops items without a source_url', () => {
    const items = [
      { source_url: '', _storeDoc: store('s1') },
      { source_url: 'https://x.pk/p1', _storeDoc: store('s1') },
    ];
    expect(dedupeItems(items).length).toBe(1);
  });

  it('falls back to store_name when _storeDoc missing', () => {
    const items = [
      { source_url: 'https://x.pk/p1', store_name: 'Daraz' },
      { source_url: 'https://x.pk/p1', store_name: 'Daraz' },
    ];
    expect(dedupeItems(items).length).toBe(1);
  });

  it('returns [] for empty input', () => {
    expect(dedupeItems([])).toEqual([]);
  });
});
