const Store = require('../models/Store');
const PipelineJob = require('../models/PipelineJob');
const City = require('../models/City');

// GET /api/v1/cities — list cities with coords (for geolocation → nearest city)
async function listCities(_req, res) {
  const cities = await City.find({}).sort({ name_en: 1 }).lean();
  const data = cities.map((c) => ({
    name_en: c.name_en,
    name_ur: c.name_ur,
    province: c.province,
    lat: c.lat,
    lng: c.lng,
  }));
  res.json({ success: true, data });
}

// GET /api/v1/stores — list all stores with category, tier, and health status
async function listStores(_req, res) {
  const stores = await Store.find({}).sort({ category: 1, name: 1 }).lean();
  const data = stores.map((s) => ({
    id: s._id,
    name: s.name,
    category: s.category,
    tier: s.tier,
    base_url: s.base_url,
    scraper_type: s.scraper_type,
    cities_served: s.cities_served,
    has_online_store: s.has_online_store, // last known health-check result
    last_checked_at: s.last_checked_at,
  }));
  res.json({ success: true, data });
}

// GET /api/v1/pipeline/status — recent pipeline job runs (health dashboard)
async function pipelineStatus(req, res) {
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const jobs = await PipelineJob.find({}).sort({ createdAt: -1 }).limit(limit).lean();

  const data = jobs.map((j) => ({
    id: j._id,
    job_type: j.job_type,
    status: j.status,
    keywords_processed: j.keywords_processed,
    records_fetched: j.records_fetched,
    flagged_records: j.flagged_records,
    started_at: j.started_at,
    finished_at: j.finished_at,
    duration_ms: j.started_at && j.finished_at ? new Date(j.finished_at) - new Date(j.started_at) : null,
    error_log: j.error_log || null,
  }));

  // Quick summary of the latest run per job_type
  const latest = {};
  for (const j of data) {
    if (!latest[j.job_type]) latest[j.job_type] = { status: j.status, finished_at: j.finished_at };
  }

  res.json({ success: true, latest, data });
}

module.exports = { listStores, pipelineStatus, listCities };
