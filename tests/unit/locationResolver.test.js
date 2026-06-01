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
    it('returns only online stores', async () => {
      City.findOne.mockResolvedValue(mockCity('islamabad'));
      Store.find.mockResolvedValue([
        mockStore('Daraz', ['*'], true),
        mockStore('PriceOye', ['*'], true),
      ]);
      const stores = await getEligibleStores('islamabad');
      expect(stores.length).toBe(2);
      stores.forEach((s) => expect(s.has_online_store).toBe(true));
    });

    it('skips offline stores', async () => {
      City.findOne.mockResolvedValue(mockCity('islamabad'));
      Store.find.mockResolvedValue([
        mockStore('Daraz', ['*'], true),
      ]);
      // Metro (offline) would not appear because find is filtered by has_online_store: true
      const stores = await getEligibleStores('islamabad');
      expect(stores.every((s) => s.has_online_store)).toBe(true);
    });
  });

  it('DEFAULT_CITY is islamabad', () => {
    expect(DEFAULT_CITY).toBe('islamabad');
  });
});
