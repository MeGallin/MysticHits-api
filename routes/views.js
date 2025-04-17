const express = require('express');
const router = express.Router();
const viewsController = require('../controllers/viewsController');

router.get('/register-view', viewsController.registerView);

module.exports = router;
