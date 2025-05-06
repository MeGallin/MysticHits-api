const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const adminMiddleware = require('../middleware/adminMiddleware');
const folderController = require('../controllers/folderController');

// All routes require authentication
router.use(auth);

// Regular user routes
router.get('/', folderController.listFolders);
router.post('/', folderController.addFolder);
router.patch('/:id', folderController.updateFolder);
router.delete('/:id', folderController.deleteFolder);
router.get('/:id/playlist', folderController.playFolder);

// Admin routes - view any user's folders
router.get('/user/:uid', adminMiddleware, folderController.listFolders);

module.exports = router;
