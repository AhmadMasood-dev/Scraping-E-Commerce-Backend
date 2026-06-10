// Manual pipeline trigger for demo/testing: `npm run pipeline:once [full|price|blog]`
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { runFullRefresh, runPriceRefresh, runBlogRefresh } = require('./runPipeline');
const { closeBrowser } = require('../scrapers/puppeteer/browser');
const logger = require('../config/logger');

async function main() {
  const mode = (process.argv[2] || 'full').toLowerCase();
  await connectDB();

  let result;
  if (mode === 'price') result = await runPriceRefresh();
  else if (mode === 'blog') result = await runBlogRefresh();
  else result = await runFullRefresh();

  logger.info(`[pipeline:once] ${mode} complete → ${JSON.stringify(result)}`);

  await closeBrowser();
  await mongoose.connection.close();
  process.exit(0);
}

main().catch((err) => {
  logger.error(`[pipeline:once] failed: ${err.message}`);
  process.exit(1);
});
