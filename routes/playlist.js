const express = require('express');
const router = express.Router();
const { getPlaylist, logPlay } = require('../controllers/playlistController');
const auth = require('../middleware/auth');

/**
 * @route   GET /api/playlist
 * @desc    Get playlist from remote URL or local folder
 * @access  Public
 */
router.get('/', getPlaylist);

/**
 * @route   POST /api/playlist/plays
 * @desc    Log a track play event
 * @access  Private (requires authentication)
 */
router.post('/plays', auth, logPlay);

module.exports = router;
