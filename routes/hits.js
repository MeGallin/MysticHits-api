const express = require('express');
const router = express.Router();
const hitsController = require('../controllers/hitsController');

router.get('/page-hits', hitsController.pageHits);

module.exports = router;
