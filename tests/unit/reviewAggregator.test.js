jest.mock('../../src/models/Review');
jest.mock('../../src/models/Product');
jest.mock('../../src/models/Store');
jest.mock('../../src/scrapers/reviews');
jest.mock('../../src/scrapers/blogs');
jest.mock('../../src/services/sentiment');

const Review = require('../../src/models/Review');
const Product = require('../../src/models/Product');
const Store = require('../../src/models/Store');
const { fetchStoreReviews } = require('../../src/scrapers/reviews');
const { findArticles } = require('../../src/scrapers/blogs');
const { scoreBlogSentiment } = require('../../src/services/sentiment');
const { getReviews, buildResponse } = require('../../src/services/reviewAggregator');

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

describe('buildResponse', () => {
  it('returns type none for empty reviews', () => {
    expect(buildResponse([])).toEqual({ type: 'none', aggregate_score: null, count: 0, reviews: [] });
  });

  it('computes aggregate and tags timeframe', () => {
    const res = buildResponse([
      { source: 'user_review', score: 5, review_date: daysAgo(10) },
      { source: 'user_review', score: 3, review_date: daysAgo(10) },
    ]);
    expect(res.type).toBe('user_review');
    expect(res.aggregate_score).toBe(4);
    expect(res.count).toBe(2);
    expect(res.reviews[0].within_timeframe).toBe(true);
  });
});

describe('getReviews', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Review.find.mockReturnValue({ lean: () => Promise.resolve([]) });
    Review.insertMany.mockResolvedValue([]);
  });

  it('returns cached reviews without scraping', async () => {
    Review.find.mockReturnValue({
      lean: () => Promise.resolve([
        { source: 'user_review', score: 4, review_date: daysAgo(5) },
      ]),
    });

    const res = await getReviews('prod1');
    expect(res.type).toBe('user_review');
    expect(res.aggregate_score).toBe(4);
    expect(fetchStoreReviews).not.toHaveBeenCalled();
    expect(findArticles).not.toHaveBeenCalled();
  });

  it('returns none when product not found', async () => {
    Product.findById.mockReturnValue({ lean: () => Promise.resolve(null) });
    const res = await getReviews('missing');
    expect(res.type).toBe('none');
  });

  it('uses store reviews when available (track 1)', async () => {
    Product.findById.mockReturnValue({
      lean: () => Promise.resolve({ _id: 'p1', name_en: 'iPhone 15', store_id: 's1', source_url: 'https://daraz.pk/x-i1.html' }),
    });
    Store.findById.mockReturnValue({ lean: () => Promise.resolve({ _id: 's1', name: 'Daraz' }) });
    fetchStoreReviews.mockResolvedValue([
      { score: 5, review_text: 'Great', review_date: daysAgo(10) },
      { score: 4, review_text: 'Good', review_date: daysAgo(20) },
    ]);

    const res = await getReviews('p1');
    expect(res.type).toBe('user_review');
    expect(res.count).toBe(2);
    expect(fetchStoreReviews).toHaveBeenCalledWith('Daraz', 'https://daraz.pk/x-i1.html');
    expect(findArticles).not.toHaveBeenCalled(); // no blog fallback needed
    expect(Review.insertMany).toHaveBeenCalled(); // cached to DB
  });

  it('falls back to blog sentiment when no store reviews (track 2)', async () => {
    Product.findById.mockReturnValue({
      lean: () => Promise.resolve({ _id: 'p2', name_en: 'Pakfan Ceiling Fan', store_id: 's2', source_url: 'https://pakfan.com/x' }),
    });
    Store.findById.mockReturnValue({ lean: () => Promise.resolve({ _id: 's2', name: 'Pakfan' }) });
    fetchStoreReviews.mockResolvedValue([]); // no store reviews
    findArticles.mockResolvedValue([
      { url: 'https://techjuice.pk/fan-review', title: 'Fan Review', date: daysAgo(60), text: 'Good fan, quiet motor.'.repeat(5) },
    ]);
    scoreBlogSentiment.mockResolvedValue({ score: 4.2, summary: 'Solid value fan' });

    const res = await getReviews('p2');
    expect(res.type).toBe('blog_sentiment');
    expect(res.aggregate_score).toBe(4.2);
    expect(res.reviews[0].blog_url).toBe('https://techjuice.pk/fan-review');
  });

  it('returns none when neither store nor blogs yield reviews', async () => {
    Product.findById.mockReturnValue({
      lean: () => Promise.resolve({ _id: 'p3', name_en: 'Obscure Item', store_id: 's3', source_url: 'https://x.pk/y' }),
    });
    Store.findById.mockReturnValue({ lean: () => Promise.resolve({ _id: 's3', name: 'UnknownStore' }) });
    fetchStoreReviews.mockResolvedValue([]);
    findArticles.mockResolvedValue([]);

    const res = await getReviews('p3');
    expect(res.type).toBe('none');
    expect(res.aggregate_score).toBeNull();
  });
});
