jest.mock('../../src/models/Store');
jest.mock('../../src/models/PipelineJob');

const Store = require('../../src/models/Store');
const PipelineJob = require('../../src/models/PipelineJob');
const { listStores, pipelineStatus } = require('../../src/controllers/store.controller');

function mockRes() {
  return { json: jest.fn(), status: jest.fn().mockReturnThis() };
}
// chainable query builder mock: .find().sort().limit().lean()
function chain(result) {
  const q = {};
  q.sort = jest.fn().mockReturnValue(q);
  q.limit = jest.fn().mockReturnValue(q);
  q.lean = jest.fn().mockResolvedValue(result);
  return q;
}

describe('listStores', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns mapped store list with health status', async () => {
    Store.find.mockReturnValue(chain([
      { _id: 's1', name: 'Daraz', category: 'A', tier: 1, scraper_type: 'api', has_online_store: true, cities_served: ['*'], last_checked_at: new Date() },
    ]));
    const res = mockRes();
    await listStores({}, res);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data[0]).toMatchObject({ name: 'Daraz', category: 'A', has_online_store: true });
  });
});

describe('pipelineStatus', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns recent jobs with computed duration and latest-per-type summary', async () => {
    const start = new Date('2026-06-07T00:00:00Z');
    const end = new Date('2026-06-07T00:05:00Z');
    PipelineJob.find.mockReturnValue(chain([
      { _id: 'j1', job_type: 'full_refresh', status: 'done', keywords_processed: 27, records_fetched: 120, flagged_records: 3, started_at: start, finished_at: end },
      { _id: 'j2', job_type: 'price_refresh', status: 'done', records_fetched: 30, started_at: start, finished_at: end },
    ]));
    const res = mockRes();
    await pipelineStatus({ query: {} }, res);
    const payload = res.json.mock.calls[0][0];
    expect(payload.data.length).toBe(2);
    expect(payload.data[0].duration_ms).toBe(5 * 60 * 1000);
    expect(payload.latest.full_refresh.status).toBe('done');
  });

  it('caps limit at 100', async () => {
    const q = chain([]);
    PipelineJob.find.mockReturnValue(q);
    const res = mockRes();
    await pipelineStatus({ query: { limit: '500' } }, res);
    expect(q.limit).toHaveBeenCalledWith(100);
  });
});
