jest.mock('../../src/models/Product');
jest.mock('../../src/services/reviewAggregator');

const Product = require('../../src/models/Product');
const { getReviews } = require('../../src/services/reviewAggregator');
const { listProducts, getProduct, getProductReviews } = require('../../src/controllers/product.controller');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

// Chainable query builder mock for Product.find().populate().sort().skip().limit().lean()
function mockQuery(resolved) {
  const q = {};
  ['populate', 'sort', 'skip', 'limit'].forEach((m) => (q[m] = jest.fn().mockReturnValue(q)));
  q.lean = jest.fn().mockResolvedValue(resolved);
  return q;
}

describe('product.controller', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('listProducts', () => {
    it('returns paginated products', async () => {
      Product.find.mockReturnValue(mockQuery([
        { _id: 'p1', name_en: 'iPhone', category: 'A', price_pkr: 200000, source_url: 'x', store_id: { _id: 's1', name: 'Daraz', category: 'A' } },
      ]));
      Product.countDocuments.mockResolvedValue(1);

      const req = { query: { page: '1', limit: '20' } };
      const res = mockRes();
      await listProducts(req, res);

      const payload = res.json.mock.calls[0][0];
      expect(payload.success).toBe(true);
      expect(payload.data.length).toBe(1);
      expect(payload.data[0].store.name).toBe('Daraz');
      expect(payload.pagination).toEqual({ page: 1, limit: 20, total: 1, pages: 1 });
    });

    it('applies category filter', async () => {
      Product.find.mockReturnValue(mockQuery([]));
      Product.countDocuments.mockResolvedValue(0);

      const req = { query: { category: 'B' } };
      await listProducts(req, mockRes());

      expect(Product.find).toHaveBeenCalledWith(expect.objectContaining({ category: 'B' }));
    });
  });

  describe('getProduct', () => {
    it('returns 404 when not found', async () => {
      Product.findById.mockReturnValue({ populate: () => ({ lean: () => Promise.resolve(null) }) });
      const res = mockRes();
      await getProduct({ params: { id: 'x' } }, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns product with price_history', async () => {
      Product.findById.mockReturnValue({
        populate: () => ({
          lean: () => Promise.resolve({
            _id: 'p1', name_en: 'TV', category: 'A', price_pkr: 80000, source_url: 'x',
            price_history: [{ price_pkr: 85000, recorded_at: new Date() }],
            store_id: { _id: 's1', name: 'Daraz', category: 'A' },
          }),
        }),
      });
      const res = mockRes();
      await getProduct({ params: { id: 'p1' } }, res);
      const payload = res.json.mock.calls[0][0];
      expect(payload.data.price_history.length).toBe(1);
    });

    it('returns 400 on invalid id (CastError)', async () => {
      const err = new Error('cast'); err.name = 'CastError';
      Product.findById.mockReturnValue({ populate: () => ({ lean: () => Promise.reject(err) }) });
      const res = mockRes();
      await getProduct({ params: { id: 'bad' } }, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getProductReviews', () => {
    it('returns 404 when product missing', async () => {
      Product.exists.mockResolvedValue(null);
      const res = mockRes();
      await getProductReviews({ params: { id: 'x' } }, res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns aggregated reviews', async () => {
      Product.exists.mockResolvedValue({ _id: 'p1' });
      getReviews.mockResolvedValue({ type: 'blog_sentiment', aggregate_score: 4.2, count: 1, reviews: [] });
      const res = mockRes();
      await getProductReviews({ params: { id: 'p1' } }, res);
      const payload = res.json.mock.calls[0][0];
      expect(payload.success).toBe(true);
      expect(payload.data.aggregate_score).toBe(4.2);
    });
  });
});
