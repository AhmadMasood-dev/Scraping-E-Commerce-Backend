const { parseProducts } = require('../../src/scrapers/cheerio/genericCheerio');

const CONFIG = {
  baseUrl: 'https://www.shophive.com',
  selectors: {
    card: 'li.product',
    title: '.product-title a',
    price: '.price',
    link: '.product-title a',
    image: 'img',
  },
};

const HTML = `
<html><body>
  <ul>
    <li class="product">
      <a class="x"></a>
      <h2 class="product-title"><a href="/apple-iphone-15">Apple iPhone 15 128GB</a></h2>
      <span class="price">Rs. 289,999</span>
      <img src="/img/iphone15.jpg" />
    </li>
    <li class="product">
      <h2 class="product-title"><a href="https://www.shophive.com/samsung-s24">Samsung Galaxy S24</a></h2>
      <span class="price">PKR 245,000</span>
      <img data-src="/img/s24.jpg" />
    </li>
    <li class="product">
      <h2 class="product-title"><a href="/no-price-item">No Price Item</a></h2>
      <span class="price"></span>
    </li>
    <li class="product">
      <h2 class="product-title"><a href="/apple-iphone-15">Duplicate URL</a></h2>
      <span class="price">Rs. 290,000</span>
    </li>
  </ul>
</body></html>`;

describe('genericCheerio parseProducts', () => {
  it('extracts products with title, price, url, image', () => {
    const items = parseProducts(HTML, CONFIG);
    expect(items.length).toBe(2); // no-price + duplicate dropped
    expect(items[0].name).toBe('Apple iPhone 15 128GB');
    expect(items[0].price).toBe(289999);
  });

  it('resolves relative URLs against baseUrl', () => {
    const items = parseProducts(HTML, CONFIG);
    expect(items[0].source_url).toBe('https://www.shophive.com/apple-iphone-15');
  });

  it('keeps absolute URLs unchanged', () => {
    const items = parseProducts(HTML, CONFIG);
    expect(items[1].source_url).toBe('https://www.shophive.com/samsung-s24');
  });

  it('reads data-src when src is absent', () => {
    const items = parseProducts(HTML, CONFIG);
    expect(items[1].image_url).toBe('/img/s24.jpg');
  });

  it('drops items with no price', () => {
    const items = parseProducts(HTML, CONFIG);
    expect(items.find((i) => i.name === 'No Price Item')).toBeUndefined();
  });

  it('dedupes by URL', () => {
    const items = parseProducts(HTML, CONFIG);
    const urls = items.map((i) => i.source_url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('respects the limit argument', () => {
    expect(parseProducts(HTML, CONFIG, 1).length).toBe(1);
  });

  it('returns [] for empty html', () => {
    expect(parseProducts('<html></html>', CONFIG)).toEqual([]);
  });
});
