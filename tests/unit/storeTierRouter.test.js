// Mock all scrapers so no real network calls happen
jest.mock('../../src/scrapers/apis/daraz');
jest.mock('../../src/scrapers/puppeteer/telemart');
jest.mock('../../src/scrapers/puppeteer/priceoye');
jest.mock('../../src/scrapers/puppeteer/pakwheels');

const daraz = require('../../src/scrapers/apis/daraz');
const telemart = require('../../src/scrapers/puppeteer/telemart');
const priceoye = require('../../src/scrapers/puppeteer/priceoye');
const pakwheels = require('../../src/scrapers/puppeteer/pakwheels');
const { runStores, storeMatchesQuery } = require('../../src/services/storeTierRouter');

describe('storeMatchesQuery — niche-store gating', () => {
  test('un-gated stores always run', () => {
    expect(storeMatchesQuery('Daraz', 'anything', [])).toBe(true);
    expect(storeMatchesQuery('Shophive', 'iphone', [])).toBe(true);
  });
  test('PakWheels runs only for car queries', () => {
    expect(storeMatchesQuery('PakWheels', 'honda civic 2020', [])).toBe(true);
    expect(storeMatchesQuery('PakWheels', 'iphone 15 pro max', [])).toBe(false);
  });
  test('Pakfan runs only for fan/appliance queries', () => {
    expect(storeMatchesQuery('Pakfan', 'ceiling fan', [])).toBe(true);
    expect(storeMatchesQuery('Pakfan', 'macbook air', [])).toBe(false);
  });
  test('matches on keywords too, not just the raw query', () => {
    expect(storeMatchesQuery('PakWheels', 'used', ['corolla'])).toBe(true);
  });
});

const makeStore = (name, scraper_type = 'api') => ({
  _id: { toString: () => name, equals: (o) => o === name },
  name,
  scraper_type,
  save: jest.fn().mockResolvedValue(true),
});

const mockProduct = (store) => ({
  name: `Test Product from ${store}`,
  price: 10000,
  image_url: 'https://img.example.com/p.jpg',
  source_url: `https://${store}.com/p`,
  store_name: store,
  scraped_at: new Date().toISOString(),
});

describe('StoreTierRouter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    daraz.searchDaraz.mockResolvedValue([mockProduct('Daraz')]);
    telemart.scrape.mockResolvedValue([mockProduct('Telemart')]);
    priceoye.scrape.mockResolvedValue([mockProduct('PriceOye')]);
    pakwheels.scrape.mockResolvedValue([mockProduct('PakWheels')]);
  });

  it('runs all matching stores in parallel and merges results', async () => {
    const stores = [makeStore('Daraz'), makeStore('Telemart'), makeStore('PriceOye')];
    const { items, meta } = await runStores(stores, 'iphone', ['iphone'], 'islamabad');

    expect(items.length).toBe(3);
    expect(meta.successStores).toEqual(expect.arrayContaining(['Daraz', 'Telemart', 'PriceOye']));
    expect(meta.failedStores).toEqual([]);
  });

  it('isolates individual store failures — other stores still return results', async () => {
    telemart.scrape.mockRejectedValue(new Error('Telemart timeout'));
    const stores = [makeStore('Daraz'), makeStore('Telemart')];
    const { items, meta } = await runStores(stores, 'laptop', ['laptop'], 'lahore');

    expect(items.length).toBe(1); // Only Daraz succeeded
    expect(meta.successStores).toContain('Daraz');
    expect(meta.failedStores).toContain('Telemart');
  });

  it('returns empty items when all stores fail', async () => {
    daraz.searchDaraz.mockRejectedValue(new Error('Daraz down'));
    const stores = [makeStore('Daraz')];
    const { items, meta } = await runStores(stores, 'tv', [], 'karachi');

    expect(items).toEqual([]);
    expect(meta.failedStores).toContain('Daraz');
  });

  it('returns empty when no stores have a scraper', async () => {
    const stores = [makeStore('UnknownStore')];
    const { items, meta } = await runStores(stores, 'phone', [], 'islamabad');
    expect(items).toEqual([]);
    expect(meta.successStores).toEqual([]);
  });

  it('attaches _storeDoc to every item', async () => {
    const stores = [makeStore('Daraz')];
    const { items } = await runStores(stores, 'samsung', [], 'islamabad');
    expect(items[0]).toHaveProperty('_storeDoc');
    expect(items[0]._storeDoc.name).toBe('Daraz');
  });

  it('includes durationMs in meta', async () => {
    const stores = [makeStore('Daraz')];
    const { meta } = await runStores(stores, 'iphone', [], 'islamabad');
    expect(typeof meta.durationMs).toBe('number');
    expect(meta.durationMs).toBeGreaterThanOrEqual(0);
  });
});
