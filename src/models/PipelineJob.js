const mongoose = require('mongoose');

const pipelineJobSchema = new mongoose.Schema({
  job_type: { type: String, enum: ['api', 'puppeteer', 'cheerio', 'blog'], required: true },
  store_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Store', default: null },
  status: { type: String, enum: ['pending', 'running', 'done', 'failed'], default: 'pending' },
  started_at: { type: Date, default: null },
  finished_at: { type: Date, default: null },
  records_fetched: { type: Number, default: 0 },
  flagged_records: { type: Number, default: 0 },
  error_log: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('PipelineJob', pipelineJobSchema);
