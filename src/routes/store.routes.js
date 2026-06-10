const { Router } = require('express');
const { listStores, pipelineStatus } = require('../controllers/store.controller');

const router = Router();

router.get('/stores', listStores);
router.get('/pipeline/status', pipelineStatus);

module.exports = router;
