const rateLimit = require('express-rate-limit');

// General API limit — 60 req/min per IP
const general = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests — please wait a minute' },
});

// Search is more expensive (scraping + Gemini) — tighter limit
const search = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many search requests — please slow down' },
});

module.exports = { general, search };
