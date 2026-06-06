jest.mock('axios');
const axios = require('axios');
const { extractItemId, parseReviewDate, fetchReviews } = require('../../src/scrapers/reviews/daraz');

describe('Daraz extractItemId', () => {
  it('extracts itemId from a full product URL', () => {
    const url = 'https://www.daraz.pk/products/apple-iphone-15-i123456789-s987654321.html';
    expect(extractItemId(url)).toBe('123456789');
  });

  it('extracts itemId without sku segment', () => {
    expect(extractItemId('https://www.daraz.pk/products/foo-i555.html')).toBe('555');
  });

  it('returns null when no itemId present', () => {
    expect(extractItemId('https://www.daraz.pk/category/phones/')).toBeNull();
    expect(extractItemId('')).toBeNull();
    expect(extractItemId(null)).toBeNull();
  });
});

describe('Daraz parseReviewDate', () => {
  it('parses epoch seconds', () => {
    const d = parseReviewDate(1700000000); // seconds
    expect(d.getUTCFullYear()).toBe(2023);
  });

  it('parses epoch milliseconds', () => {
    const d = parseReviewDate(1700000000000);
    expect(d.getUTCFullYear()).toBe(2023);
  });

  it('parses a date string', () => {
    const d = parseReviewDate('2025-03-10');
    expect(d.getUTCFullYear()).toBe(2025);
  });

  it('returns null for invalid input', () => {
    expect(parseReviewDate('garbage')).toBeNull();
    expect(parseReviewDate(null)).toBeNull();
  });
});

describe('Daraz fetchReviews', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns [] when URL has no itemId (no network call)', async () => {
    const reviews = await fetchReviews('https://www.daraz.pk/category/x/');
    expect(reviews).toEqual([]);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('maps API response to normalised reviews', async () => {
    axios.get.mockResolvedValue({
      data: { model: { items: [
        { rating: 5, reviewContent: 'Great!', reviewTime: '2025-12-01' },
        { rating: 3, reviewContent: 'Okay', reviewTime: '2025-06-01' },
      ] } },
    });
    const reviews = await fetchReviews('https://www.daraz.pk/products/x-i999.html');
    expect(reviews.length).toBe(2);
    expect(reviews[0]).toMatchObject({ score: 5, review_text: 'Great!' });
    expect(reviews[0].review_date).toBeInstanceOf(Date);
  });

  it('filters out reviews missing score or date', async () => {
    axios.get.mockResolvedValue({
      data: { model: { items: [
        { rating: 4, reviewContent: 'good', reviewTime: '2025-12-01' },
        { rating: null, reviewContent: 'no rating', reviewTime: '2025-12-01' },
        { rating: 4, reviewContent: 'no date', reviewTime: 'garbage' },
      ] } },
    });
    const reviews = await fetchReviews('https://www.daraz.pk/products/x-i999.html');
    expect(reviews.length).toBe(1);
  });

  it('returns [] gracefully on network error', async () => {
    axios.get.mockRejectedValue(new Error('timeout'));
    const reviews = await fetchReviews('https://www.daraz.pk/products/x-i999.html');
    expect(reviews).toEqual([]);
  });
});
