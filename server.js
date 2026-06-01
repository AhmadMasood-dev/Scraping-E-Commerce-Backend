require('dotenv').config();
const app = require('./app');
const connectDB = require('./src/config/db');
const logger = require('./src/config/logger');
const { seedDatabase } = require('./src/seed/seed');
const { closeBrowser } = require('./src/scrapers/puppeteer/browser');

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();
  await seedDatabase();

  const server = app.listen(PORT, () => {
    logger.info(`PQC Backend running on http://localhost:${PORT}`);
  });

  // Graceful shutdown — close browser + DB on SIGTERM / SIGINT
  async function shutdown(signal) {
    logger.info(`[Server] ${signal} received — shutting down gracefully`);
    server.close(async () => {
      await closeBrowser();
      const mongoose = require('mongoose');
      await mongoose.connection.close();
      logger.info('[Server] Clean exit');
      process.exit(0);
    });
    // Force exit after 10s if something hangs
    setTimeout(() => process.exit(1), 10000);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Catch unhandled promise rejections — log and continue (don't crash)
  process.on('unhandledRejection', (reason) => {
    logger.error(`[Server] Unhandled rejection: ${reason}`);
  });
}

start().catch((err) => {
  logger.error('Server startup failed:', err);
  process.exit(1);
});
