const express = require('express');
const router = express.Router();
const { 
  getPlaylist, 
  logPlay, 
  updatePlayEvent, 
  batchUpdatePlayEvents, 
  logInteraction 
} = require('../controllers/playlistController');
const auth = require('../middleware/auth');

/**
 * @route   GET /api/playlist
 * @desc    Get playlist from remote URL or local folder
 * @access  Public
 */
router.get('/', getPlaylist);

/**
 * @route   POST /api/playlist/plays
 * @desc    Log a track play event with enhanced analytics
 * @access  Private (requires authentication)
 */
router.post('/plays', auth, logPlay);

/**
 * @route   PUT /api/playlist/plays/:playEventId
 * @desc    Update a play event with progress/completion data
 * @access  Private (requires authentication)
 */
router.put('/plays/:playEventId', auth, updatePlayEvent);

/**
 * @route   POST /api/playlist/plays/batch-update
 * @desc    Batch update multiple play events
 * @access  Private (requires authentication)
 */
router.post('/plays/batch-update', auth, batchUpdatePlayEvents);

/**
 * @route   POST /api/playlist/interactions
 * @desc    Log user interactions (like, share, repeat)
 * @access  Private (requires authentication)
 */
router.post('/interactions', auth, logInteraction);

module.exports = router;
