const { Router } = require('express');
const { listStores, pipelineStatus, listCities } = require('../controllers/store.controller');

const router = Router();

router.get('/stores', listStores);
router.get('/cities', listCities);
router.get('/pipeline/status', pipelineStatus);

module.exports = router;
