const Product = require('../models/Product');
const { getReviews } = require('../services/reviewAggregator');
const logger = require('../config/logger');

// GET /api/v1/products?category=A&store=&q=&page=1&limit=20&sort=price_asc
async function listProducts(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.category && ['A', 'B', 'C', 'D'].includes(req.query.category)) {
      filter.category = req.query.category;
    }
    if (req.query.store) filter.store_id = req.query.store;
    if (req.query.q) filter.$text = { $search: req.query.q };

    const sortMap = {
      price_asc: { price_pkr: 1 },
      price_desc: { price_pkr: -1 },
      newest: { updatedAt: -1 },
      rating: { rating: -1 },
    };
    const sort = sortMap[req.query.sort] || { updatedAt: -1 };

    const [items, total] = await Promise.all([
      Product.find(filter).populate('store_id', 'name category').sort(sort).skip(skip).limit(limit).lean(),
      Product.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: items.map(formatProduct),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    logger.error(`[Products] list error: ${err.message}`);
    return res.status(500).json({ success: false, error: 'Failed to fetch products' });
  }
}

// GET /api/v1/products/:id — detail + price history
async function getProduct(req, res) {
  try {
    const product = await Product.findById(req.params.id).populate('store_id', 'name category base_url').lean();
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });

    return res.json({
      success: true,
      data: {
        ...formatProduct(product),
        price_history: (product.price_history || []).map((h) => ({
          price_pkr: h.price_pkr,
          recorded_at: h.recorded_at,
        })),
      },
    });
  } catch (err) {
    if (err.name === 'CastError') return res.status(400).json({ success: false, error: 'Invalid product id' });
    logger.error(`[Products] get error: ${err.message}`);
    return res.status(500).json({ success: false, error: 'Failed to fetch product' });
  }
}

// GET /api/v1/products/:id/reviews — user reviews or blog-sentiment fallback
async function getProductReviews(req, res) {
  try {
    const exists = await Product.exists({ _id: req.params.id });
    if (!exists) return res.status(404).json({ success: false, error: 'Product not found' });

    const reviews = await getReviews(req.params.id);
    return res.json({ success: true, data: reviews });
  } catch (err) {
    if (err.name === 'CastError') return res.status(400).json({ success: false, error: 'Invalid product id' });
    logger.error(`[Products] reviews error: ${err.message}`);
    return res.status(500).json({ success: false, error: 'Failed to fetch reviews' });
  }
}

function formatProduct(p) {
  return {
    id: p._id,
    name_en: p.name_en,
    name_ur: p.name_ur || '',
    brand: p.brand || '',
    category: p.category,
    price_pkr: p.price_pkr,
    image_url: p.image_url || '',
    source_url: p.source_url,
    rating: p.rating ?? null,
    timeframe_tag: p.timeframe_tag,
    confidence: p.confidence,
    store: p.store_id && typeof p.store_id === 'object'
      ? { id: p.store_id._id, name: p.store_id.name, category: p.store_id.category }
      : null,
    updated_at: p.updatedAt,
  };
}

module.exports = { listProducts, getProduct, getProductReviews };
