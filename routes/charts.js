const express = require('express');
const router = express.Router();
const { getMostPlayed } = require('../controllers/chartsController');

/**
 * @route   GET /api/charts/:storefront
 * @desc    Get Apple Music "Most-Played" songs for a specific storefront
 * @access  Public
 * @param   {string} storefront - Country code for Apple Music storefront (e.g., 'us', 'gb')
 */
router.get('/:storefront', getMostPlayed);

module.exports = router;
