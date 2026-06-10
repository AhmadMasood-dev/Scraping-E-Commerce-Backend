const fs = require('fs');
const path = require('path');
const os = require('os');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const logger = require('../../config/logger');

puppeteer.use(StealthPlugin());

// Resolve a Chrome executable. Puppeteer pins a specific Chrome build; if that
// exact build isn't installed (e.g. only a newer one is), Puppeteer errors out.
// We decouple from that: use PUPPETEER_EXECUTABLE_PATH if set, otherwise pick
// any chrome binary present in the Puppeteer cache. Returns undefined to let
// Puppeteer use its own default when nothing is found.
function resolveChromePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  const cacheDir = path.join(os.homedir(), '.cache', 'puppeteer', 'chrome');
  try {
    const builds = fs.readdirSync(cacheDir);
    for (const build of builds) {
      const bin = path.join(cacheDir, build, 'chrome-linux64', 'chrome');
      if (fs.existsSync(bin)) return bin;
    }
  } catch (_e) { /* cache dir missing — fall through */ }
  return undefined;
}

// Singleton browser — reused across requests, restarted if it crashes
let _browser = null;

async function getBrowser() {
  if (_browser && _browser.isConnected()) return _browser;

  const executablePath = resolveChromePath();
  logger.info(`[Browser] Launching Puppeteer${executablePath ? ` (chrome: ${executablePath})` : ''}...`);
  _browser = await puppeteer.launch({
    headless: 'new',
    executablePath, // undefined → Puppeteer default
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
