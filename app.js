require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { general, search: searchLimit } = require('./src/middlewares/rateLimit');
const { errorHandler, notFound } = require('./src/middlewares/errorHandler');
const searchRoutes = require('./src/routes/search.routes');

const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10kb' }));
app.use(general);

app.get('/health', (_req, res) =>
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
);

// Search route has its own tighter rate limit
app.use('/api/v1/search', searchLimit, searchRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
