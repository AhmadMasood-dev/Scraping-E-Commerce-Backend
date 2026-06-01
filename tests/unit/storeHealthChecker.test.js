jest.mock('axios');
jest.mock('../../src/models/Store');

const axios = require('axios');
const Store = require('../../src/models/Store');
const { checkStoreOnline, filterOnlineStores, clearCache } = require('../../src/services/storeHealthChecker');

// Each test uses a unique store id so the module's 1hr LRU cache never collides across tests.
const makeStore = (name, id = name) => ({
  _id: { toString: () => id },
  name,
  base_url: `https://www.${name.toLowerCase()}.pk`,
});

beforeEach(() => {
  jest.clearAllMocks();
  // Background DB write — must return a thenable with .catch()
  Store.findByIdAndUpdate = jest.fn().mockResolvedValue(null);
});

describe('checkStoreOnline', () => {
  it('returns true for a 200 response', async () => {
    axios.head.mockResolvedValue({ status: 200 });
    expect(await checkStoreOnline(makeStore('Daraz'))).toBe(true);
  });

  it('returns true for a 404 (site exists, page missing)', async () => {
    axios.head.mockResolvedValue({ status: 404 });
    expect(await checkStoreOnline(makeStore('Telemart'))).toBe(true);
  });

  it('returns false for a 500 response', async () => {
    axios.head.mockResolvedValue({ status: 500 });
    expect(await checkStoreOnline(makeStore('PriceOye'))).toBe(false);
  });

  it('returns false on network error (DNS / timeout)', async () => {
    axios.head.mockRejectedValue(new Error('ECONNREFUSED'));
    expect(await checkStoreOnline(makeStore('PakWheels'))).toBe(false);
  });

  it('caches the result — second call does not hit axios again', async () => {
    axios.head.mockResolvedValue({ status: 200 });
    const store = makeStore('Daraz', 'cached-store');
    await checkStoreOnline(store);
    await checkStoreOnline(store);
    expect(axios.head).toHaveBeenCalledTimes(1);
  });
});

describe('clearCache', () => {
  it('forces a fresh axios call after the cache is cleared', async () => {
    axios.head.mockResolvedValue({ status: 200 });
    const store = makeStore('Daraz', 'clear-test');
    await checkStoreOnline(store);
    clearCache(store._id);
    await checkStoreOnline(store);
    expect(axios.head).toHaveBeenCalledTimes(2);
  });
});

describe('filterOnlineStores', () => {
  it('returns only the online stores', async () => {
    axios.head
      .mockResolvedValueOnce({ status: 200 }) // Daraz → online
      .mockRejectedValueOnce(new Error('timeout')); // Telemart → offline
    const stores = [makeStore('Daraz', 'f1'), makeStore('Telemart', 'f2')];
    const online = await filterOnlineStores(stores);
    expect(online.map((s) => s.name)).toEqual(['Daraz']);
  });

  it('returns an empty array when all stores are offline', async () => {
    axios.head.mockRejectedValue(new Error('offline'));
    const stores = [makeStore('Daraz', 'g1'), makeStore('Telemart', 'g2')];
    expect(await filterOnlineStores(stores)).toEqual([]);
  });

  it('returns all stores when all are online', async () => {
    axios.head.mockResolvedValue({ status: 200 });
    const stores = [makeStore('Daraz', 'h1'), makeStore('PriceOye', 'h2'), makeStore('PakWheels', 'h3')];
    expect(await filterOnlineStores(stores)).toHaveLength(3);
  });
});
