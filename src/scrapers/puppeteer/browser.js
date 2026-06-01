const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const logger = require('../../config/logger');

puppeteer.use(StealthPlugin());

// Singleton browser — reused across requests, restarted if it crashes
let _browser = null;

async function getBrowser() {
  if (_browser && _browser.isConnected()) return _browser;

  logger.info('[Browser] Launching Puppeteer...');
  _browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1280,800',
    ],
  });

  // Auto-null on crash so next call relaunches
  _browser.on('disconnected', () => {
    logger.warn('[Browser] Disconnected — will relaunch on next request');
    _browser = null;
  });

  return _browser;
}

// Opens a new page with performance settings applied:
// - blocks images, fonts, stylesheets, media (3-5x faster scraping)
// - sets a random user-agent
async function newPage(ua) {
  const browser = await getBrowser();
  const page = await browser.newPage();

  await page.setUserAgent(ua);

  // Block resource types that are not needed for scraping
  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const type = req.resourceType();
    if (['image', 'stylesheet', 'font', 'media', 'other'].includes(type)) {
      req.abort();
    } else {
      req.continue();
    }
  });

  // Suppress console noise from scraped pages
  page.on('console', () => {});
  page.on('pageerror', () => {});

  return page;
}

// Gracefully close the browser (call on process exit)
async function closeBrowser() {
  if (_browser) {
    await _browser.close().catch(() => {});
    _browser = null;
  }
}

module.exports = { getBrowser, newPage, closeBrowser };
