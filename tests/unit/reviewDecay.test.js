const { decayFor, aggregateScore } = require('../../src/services/reviewDecay');

const NOW = new Date('2026-06-07T00:00:00Z');
const daysAgo = (n) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

describe('decayFor', () => {
  it('full weight for reviews under 6 months', () => {
    expect(decayFor(daysAgo(30), NOW)).toEqual({ weight: 1.0, within_timeframe: true });
    expect(decayFor(daysAgo(181), NOW)).toEqual({ weight: 1.0, within_timeframe: true });
  });

  it('0.7 weight for 6–18 months', () => {
    expect(decayFor(daysAgo(200), NOW)).toEqual({ weight: 0.7, within_timeframe: true });
    expect(decayFor(daysAgo(547), NOW)).toEqual({ weight: 0.7, within_timeframe: true });
  });

  it('0.4 weight + out of timeframe for > 18 months', () => {
    expect(decayFor(daysAgo(600), NOW)).toEqual({ weight: 0.4, within_timeframe: false });
    expect(decayFor(daysAgo(2000), NOW)).toEqual({ weight: 0.4, within_timeframe: false });
  });

  it('treats unknown/invalid date as old', () => {
    expect(decayFor('not-a-date', NOW)).toEqual({ weight: 0.4, within_timeframe: false });
  });

  it('accepts ISO string dates', () => {
    expect(decayFor(daysAgo(10).toISOString(), NOW)).toEqual({ weight: 1.0, within_timeframe: true });
  });
});

describe('aggregateScore', () => {
  it('returns null for empty/invalid input', () => {
    expect(aggregateScore([], NOW)).toBeNull();
    expect(aggregateScore(null, NOW)).toBeNull();
  });

  it('simple average when all reviews are fresh (weight 1.0)', () => {
    const reviews = [
      { score: 5, review_date: daysAgo(10) },
      { score: 3, review_date: daysAgo(20) },
    ];
    expect(aggregateScore(reviews, NOW)).toBe(4); // (5+3)/2
  });

  it('down-weights old reviews', () => {
    // fresh 5-star (w=1.0) vs very old 1-star (w=0.4)
    // (5*1.0 + 1*0.4) / (1.0 + 0.4) = 5.4 / 1.4 = 3.857 → 3.9
    const reviews = [
      { score: 5, review_date: daysAgo(10) },
      { score: 1, review_date: daysAgo(700) },
    ];
    expect(aggregateScore(reviews, NOW)).toBe(3.9);
  });

  it('skips reviews with non-numeric scores', () => {
    const reviews = [
      { score: 4, review_date: daysAgo(10) },
      { score: null, review_date: daysAgo(10) },
    ];
    expect(aggregateScore(reviews, NOW)).toBe(4);
  });

  it('rounds to one decimal place', () => {
    const reviews = [
      { score: 5, review_date: daysAgo(10) },
      { score: 4, review_date: daysAgo(10) },
      { score: 4, review_date: daysAgo(10) },
    ];
    expect(aggregateScore(reviews, NOW)).toBe(4.3); // 13/3 = 4.333 → 4.3
  });
});
