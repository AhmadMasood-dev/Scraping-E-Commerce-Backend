const cron = require('node-cron');
const { runFullRefresh, runPriceRefresh, runBlogRefresh } = require('./runPipeline');
const logger = require('../config/logger');

// Cron schedules (server local time):
//   Full refresh   — every 6 hours (00:00, 06:00, 12:00, 18:00)
//   Price refresh  — every 2 hours
//   Blog refresh   — daily at 03:00 (bounded review-gap fill)
const SCHEDULES = {
  full: '0 */6 * * *',
  price: '0 */2 * * *',
  blog: '0 3 * * *',
};

let tasks = [];

// Guard so a long-running cycle never overlaps the next tick
let busy = false;
async function guarded(fn, label) {
  if (busy) {
    logger.warn(`[Scheduler] ${label} skipped — previous cycle still running`);
    return;
  }
  busy = true;
  try {
    await fn();
  } catch (err) {
    logger.error(`[Scheduler] ${label} error: ${err.message}`);
  } finally {
    busy = false;
  }
}

// Starts the cron jobs. Only call when ENABLE_PIPELINE=true (see server.js).
function startScheduler() {
  if (tasks.length) return; // already started
  tasks = [
    cron.schedule(SCHEDULES.full, () => guarded(runFullRefresh, 'full_refresh')),
    cron.schedule(SCHEDULES.price, () => guarded(runPriceRefresh, 'price_refresh')),
    cron.schedule(SCHEDULES.blog, () => guarded(runBlogRefresh, 'blog')),
  ];
  logger.info('[Scheduler] Background pipeline scheduled (full 6h · price 2h · blog daily)');
}

function stopScheduler() {
  tasks.forEach((t) => t.stop());
  tasks = [];
}

module.exports = { startScheduler, stopScheduler, SCHEDULES };
