const { Router } = require('express');
const { search } = require('../controllers/search.controller');
const { searchArticles } = require('../controllers/articles.controller');

const router = Router();

// GET /api/v1/search?query=iphone&city=islamabad&lang=en
router.get('/', search);
// GET /api/v1/search/articles?q=iphone  (lazy blog strip)
router.get('/articles', searchArticles);

module.exports = router;
