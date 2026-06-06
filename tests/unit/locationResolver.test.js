// These tests mock mongoose so no DB connection is needed
jest.mock('../../src/models/City');
jest.mock('../../src/models/Store');

const City = require('../../src/models/City');
const Store = require('../../src/models/Store');
const { resolveCity, getEligibleStores, DEFAULT_CITY } = require('../../src/services/locationResolver');

const mockCity = (name) => ({ name_en: name, name_ur: '', province: 'Punjab', aliases: [name] });
const mockStore = (name, cities, hasOnline = true) => ({ name, has_online_store: hasOnline, cities_served: cities });

describe('LocationResolver', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('resolveCity', () => {
    it('resolves known city', async () => {
      City.findOne.mockResolvedValue(mockCity('karachi'));
      const city = await resolveCity('karachi');
      expect(city.name_en).toBe('karachi');
    });

    it('defaults to islamabad for unknown city', async () => {
      City.findOne
        .mockResolvedValueOnce(null) // unknown city lookup
        .mockResolvedValueOnce(mockCity('islamabad')); // default fallback
      const city = await resolveCity('unknowncity');
      expect(city.name_en).toBe('islamabad');
    });

    it('defaults to islamabad when no city provided', async () => {
      City.findOne.mockResolvedValue(mockCity('islamabad'));
      const city = await resolveCity(undefined);
      expect(city.name_en).toBe('islamabad');
    });
  });

  describe('getEligibleStores', () => {
    it('returns all city-matching candidate stores', async () => {
      City.findOne.mockResolvedValue(mockCity('islamabad'));
      Store.find.mockResolvedValue([
        mockStore('Daraz', ['*'], true),
        mockStore('PriceOye', ['*'], true),
      ]);
      const stores = await getEligibleStores('islamabad');
      expect(stores.length).toBe(2);
    });

    it('does NOT filter by online status — that is the health checker\'s job', async () => {
      // getEligibleStores returns candidates regardless of has_online_store.
      // filterOnlineStores (tested separately) decides reachability at runtime.
      City.findOne.mockResolvedValue(mockCity('islamabad'));
      Store.find.mockResolvedValue([
        mockStore('Daraz', ['*'], true),
        mockStore('Metro', ['islamabad'], false), // offline in DB, still returned as a candidate
      ]);
      const stores = await getEligibleStores('islamabad');
      expect(stores.length).toBe(2);
      expect(stores.map((s) => s.name)).toContain('Metro');
    });

    it('query passed to Store.find does NOT include has_online_store', async () => {
      City.findOne.mockResolvedValue(mockCity('islamabad'));
      Store.find.mockResolvedValue([]);
      await getEligibleStores('islamabad');
      const queryArg = Store.find.mock.calls[0][0];
      expect(queryArg).not.toHaveProperty('has_online_store');
    });
  });

  it('DEFAULT_CITY is islamabad', () => {
    expect(DEFAULT_CITY).toBe('islamabad');
  });
});
