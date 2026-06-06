const axios = require('axios');
const cheerio = require('cheerio');
const { randomUA } = require('../utils/userAgent');
const logger = require('../../config/logger');

// TechJuice and ProPakistani are WordPress sites. WordPress exposes an on-site
// search at /?s=<query> and consistent article markup, so one generic scraper
// (configured per site) handles both. Far more reliable than scraping Google.

// ── Pure parsers (no network — unit-testable with fixture HTML) ──────────────

// Parse a WordPress search results page → [{ title, url }]
function parseSearchResults(html, baseUrl) {
  const $ = cheerio.load(html);
  const out = [];
  const seen = new Set();

  // Article cards: <article> or .post / .type-post, with the link in a heading
  $('article, .post, .type-post, .jeg_post, .td_module_wrap').each((_, el) => {
    const a = $(el).find('h1 a, h2 a, h3 a, .entry-title a, .jeg_post_title a').first();
    let url = a.attr('href') || '';
    const title = a.text().replace(/\s+/g, ' ').trim();
    if (!url || !title) return;
    if (url.startsWith('/')) url = baseUrl.replace(/\/$/, '') + url;
    if (seen.has(url)) return;
    seen.add(url);
    out.push({ title, url });
  });

  return out;
}

// Parse a single WordPress article → { title, date, text }
function parseArticle(html) {
  const $ = cheerio.load(html);

  const title =
    $('meta[property="og:title"]').attr('content') ||
    $('h1.entry-title, h1.post-title, h1').first().text().replace(/\s+/g, ' ').trim() ||
    '';

  // Published date — meta tag is most reliable, then <time datetime>
  const dateRaw =
    $('meta[property="article:published_time"]').attr('content') ||
    $('time.entry-date, time.published, time[datetime]').first().attr('datetime') ||
    $('time.entry-date, time.published').first().text().trim() ||
    '';
  const date = dateRaw ? new Date(dateRaw) : null;

  // Body — prefer the main content container, strip scripts/styles
  const container = $('.entry-content, .post-content, .td-post-content, article').first();
  container.find('script, style, .related-posts, .comments, nav, aside').remove();
  const text = container.text().replace(/\s+/g, ' ').trim();

  return { title, date: date && !isNaN(date.getTime()) ? date : null, text };
}

// ── Network layer ────────────────────────────────────────────────────────────

function createBlogScraper(config) {
  const { name, baseUrl } = config;

  async function get(url) {
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': randomUA(), Accept: 'text/html' },
      timeout: 12000,
      maxRedirects: 3,
    });
    return data;
  }

  async function search(query, limit = 3) {
    try {
      const url = `${baseUrl.replace(/\/$/, '')}/?s=${encodeURIComponent(query)}`;
      const html = await get(url);
      const results = parseSearchResults(html, baseUrl).slice(0, limit);
      logger.info(`[Blog:${name}] search "${query}" → ${results.length} articles`);
      return results.map((r) => ({ ...r, source: name }));
    } catch (err) {
      logger.warn(`[Blog:${name}] search failed: ${err.message}`);
      return [];
    }
  }

  async function fetchArticle(url) {
    try {
      const html = await get(url);
      return { ...parseArticle(html), url, source: name };
    } catch (err) {
      logger.warn(`[Blog:${name}] fetchArticle failed (${url}): ${err.message}`);
      return null;
    }
  }

  return { name, baseUrl, search, fetchArticle };
}

module.exports = { parseSearchResults, parseArticle, createBlogScraper };
