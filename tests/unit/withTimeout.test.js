const { withTimeout } = require('../../src/scrapers/utils/withTimeout');

describe('withTimeout', () => {
  it('returns fn result when it completes before timeout', async () => {
    const result = await withTimeout(() => Promise.resolve([1, 2, 3]), 1000, 'TestStore');
    expect(result).toEqual([1, 2, 3]);
  });

  it('returns fallback [] when fn exceeds timeout', async () => {
    const slowFn = () => new Promise((r) => setTimeout(r, 5000));
    const result = await withTimeout(slowFn, 50, 'SlowStore');
    expect(result).toEqual([]);
  }, 10000);

  it('returns custom fallback on timeout', async () => {
    const slowFn = () => new Promise((r) => setTimeout(r, 5000));
    const result = await withTimeout(slowFn, 50, 'SlowStore', { error: true });
    expect(result).toEqual({ error: true });
  }, 10000);

  it('returns fallback when fn throws', async () => {
    const result = await withTimeout(() => Promise.reject(new Error('boom')), 1000, 'BrokenStore');
    expect(result).toEqual([]);
  });
});
