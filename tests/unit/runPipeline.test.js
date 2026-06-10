// Mock all dependencies so processKeyword orchestration can be tested in isolation
jest.mock('../../src/services/storeTierRouter');
jest.mock('../../src/services/geminiClassifier');
jest.mock('../../src/services/scraper.service');

const { runStores } = require('../../src/services/storeTierRouter');
const { classifyProducts } = require('../../src/services/geminiClassifier');
const { upsertProducts } = require('../../src/services/scraper.service');
const { processKeyword } = require('../../src/pipeline/runPipeline');

const store = (id, name) => ({
  _id: { toString: () => id },
  name,
  last_checked_at: null,
  save: jest.fn().mockResolvedValue(true),
});

describe('processKeyword', () => {
  beforeEach(() => jest.clearAllMocks());

  it('scrapes, classifies, and upserts grouped by store', async () => {
    const s1 = store('s1', 'Daraz');
    runStores.mockResolvedValue({
      items: [
        { source_url: 'https://daraz.pk/p1', rating: 4, _storeDoc: s1 },
        { source_url: 'https://daraz.pk/p2', rating: null, _storeDoc: s1 },
      ],
      meta: {},
    });
    classifyProducts.mockResolvedValue([
      { name_en: 'P1', price_pkr: 100, category: 'A', confidence: 0.9, source_url: 'https://daraz.pk/p1' },
      { name_en: 'P2', price_pkr: 200, category: 'A', confidence: 0.6, source_url: 'https://daraz.pk/p2' },
    ]);
    upsertProducts.mockResolvedValue({ upserted: 2, updated: 0, skipped: 0 });

    const r = await processKeyword('iphone', [s1]);
    expect(upsertProducts).toHaveBeenCalledTimes(1);
    expect(r.upserted).toBe(2);
    expect(r.flagged).toBe(1); // one item confidence < 0.8
  });

  it('returns zeros when scrape yields nothing', async () => {
    runStores.mockResolvedValue({ items: [], meta: {} });
    const r = await processKeyword('nothing', [store('s1', 'Daraz')]);
    expect(r).toEqual({ upserted: 0, updated: 0, flagged: 0 });
    expect(classifyProducts).not.toHaveBeenCalled();
  });

  it('dedupes duplicate listings before classifying', async () => {
    const s1 = store('s1', 'Daraz');
    runStores.mockResolvedValue({
      items: [
        { source_url: 'https://daraz.pk/dup', _storeDoc: s1 },
        { source_url: 'https://daraz.pk/dup', _storeDoc: s1 },
      ],
      meta: {},
    });
    classifyProducts.mockResolvedValue([
      { name_en: 'Dup', price_pkr: 100, category: 'A', confidence: 0.9, source_url: 'https://daraz.pk/dup' },
    ]);
    upsertProducts.mockResolvedValue({ upserted: 1, updated: 0, skipped: 0 });

    await processKeyword('dup', [s1]);
    // classifyProducts should receive only 1 item after dedup
    expect(classifyProducts.mock.calls[0][0].length).toBe(1);
  });
});
