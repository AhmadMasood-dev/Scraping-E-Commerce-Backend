const { Router } = require('express');
const { listProducts, getProduct, getProductReviews } = require('../controllers/product.controller');

const router = Router();

router.get('/', listProducts);
router.get('/:id', getProduct);
router.get('/:id/reviews', getProductReviews);

module.exports = router;
