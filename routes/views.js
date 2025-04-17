const express = require('express');
const router = express.Router();
const viewsController = require('../controllers/viewsController');
const auth = require('../middleware/auth');

router.get('/register-view', auth, viewsController.registerView);

module.exports = router;
