const { createBlogScraper } = require('./wordpressBlog');
const { withTimeout } = require('../utils/withTimeout');
const logger = require('../../config/logger');

// Category D blog sources — all WordPress, queried via on-site search.
const BLOGS = [
  createBlogScraper({ name: 'TechJuice', baseUrl: 'https://www.techjuice.pk' }),
  createBlogScraper({ name: 'ProPakistani', baseUrl: 'https://propakistani.pk' }),
];

// Given a product name, find relevant blog articles across all sources and
// return their full text for sentiment scoring.
// Returns: [{ source, url, title, date, text }]
async function findArticles(productName, perBlog = 2) {
  // 1. Search every blog in parallel for candidate articles
  const searchTasks = BLOGS.map((blog) =>
    withTimeout(() => blog.search(productName, perBlog), 12000, `Blog:${blog.name}`)
  );
  const searchResults = (await Promise.all(searchTasks)).flat();

  if (searchResults.length === 0) {
    logger.info(`[Blogs] No articles found for "${productName}"`);
    return [];
  }

  // 2. Fetch the full text of each candidate article in parallel
  const blogByName = Object.fromEntries(BLOGS.map((b) => [b.name, b]));
  const fetchTasks = searchResults.map((r) =>
    withTimeout(() => blogByName[r.source].fetchArticle(r.url), 12000, `Blog:${r.source}`, null)
  );
  const articles = (await Promise.all(fetchTasks)).filter((a) => a && a.text && a.text.length > 50);

  logger.info(`[Blogs] "${productName}" → ${articles.length} articles with content`);
  return articles;
}

module.exports = { findArticles, BLOGS };
