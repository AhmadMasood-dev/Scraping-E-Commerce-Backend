const { parseSearchResults, parseArticle } = require('../../src/scrapers/blogs/wordpressBlog');

const SEARCH_HTML = `
<html><body>
  <div class="search-results">
    <article class="post">
      <h2 class="entry-title"><a href="/2026/01/iphone-15-review">iPhone 15 Review: Worth It?</a></h2>
    </article>
    <article class="post">
      <h2 class="entry-title"><a href="https://propakistani.pk/2025/12/iphone-15-camera">iPhone 15 Camera Test</a></h2>
    </article>
    <article class="post">
      <h2 class="entry-title"><a href="/2026/01/iphone-15-review">Duplicate Link</a></h2>
    </article>
  </div>
</body></html>`;

const ARTICLE_HTML = `
<html><head>
  <meta property="og:title" content="iPhone 15 Review: Worth It?" />
  <meta property="article:published_time" content="2026-01-15T10:00:00Z" />
</head><body>
  <h1 class="entry-title">iPhone 15 Review: Worth It?</h1>
  <time class="entry-date" datetime="2026-01-15T10:00:00Z">Jan 15, 2026</time>
  <div class="entry-content">
    <p>The iPhone 15 is a great phone with an excellent camera.</p>
    <script>var ads = true;</script>
    <p>Battery life is solid and performance is top notch.</p>
    <div class="related-posts"><a href="/other">Other article</a></div>
  </div>
</body></html>`;

describe('parseSearchResults', () => {
  it('extracts article links from a WordPress search page', () => {
    const results = parseSearchResults(SEARCH_HTML, 'https://propakistani.pk');
    expect(results.length).toBe(2); // duplicate removed
    expect(results[0].title).toBe('iPhone 15 Review: Worth It?');
  });

  it('resolves relative URLs to absolute', () => {
    const results = parseSearchResults(SEARCH_HTML, 'https://propakistani.pk');
    expect(results[0].url).toBe('https://propakistani.pk/2026/01/iphone-15-review');
  });

  it('keeps already-absolute URLs unchanged', () => {
    const results = parseSearchResults(SEARCH_HTML, 'https://propakistani.pk');
    expect(results[1].url).toBe('https://propakistani.pk/2025/12/iphone-15-camera');
  });

  it('returns empty array for no results', () => {
    expect(parseSearchResults('<html><body>nothing</body></html>', 'https://x.pk')).toEqual([]);
  });
});

describe('parseArticle', () => {
  it('extracts title, date, and body text', () => {
    const article = parseArticle(ARTICLE_HTML);
    expect(article.title).toBe('iPhone 15 Review: Worth It?');
    expect(article.date).toBeInstanceOf(Date);
    expect(article.date.getUTCFullYear()).toBe(2026);
    expect(article.text).toContain('great phone');
    expect(article.text).toContain('Battery life');
  });

  it('strips scripts and related-posts noise from body', () => {
    const article = parseArticle(ARTICLE_HTML);
    expect(article.text).not.toContain('var ads');
    expect(article.text).not.toContain('Other article');
  });

  it('returns null date when no date present', () => {
    const html = '<html><body><div class="entry-content">Some text here about a product.</div></body></html>';
    const article = parseArticle(html);
    expect(article.date).toBeNull();
    expect(article.text).toContain('Some text');
  });
});
