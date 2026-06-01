const { Router } = require('express');
const { search } = require('../controllers/search.controller');

const router = Router();

// GET /api/v1/search?query=iphone&city=islamabad&lang=en
router.get('/', search);

module.exports = router;
