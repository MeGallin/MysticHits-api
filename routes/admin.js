const express = require('express');
const router = express.Router();
const adminMiddleware = require('../middleware/adminMiddleware');
const adminController = require('../controllers/adminController');

// Apply admin middleware to all routes
router.use(adminMiddleware);

// GET all users - protected for admins only
router.get('/users', adminController.getUsers);

// DELETE a user by ID - protected for admins only
router.delete('/users/:id', adminController.deleteUser);

// PATCH change user role - protected for admins only
router.patch('/users/:id/role', adminController.changeUserRole);

// GET system statistics - protected for admins only
router.get('/stats', adminController.getStats);

// NEW ENDPOINTS - User data aggregation
// GET daily/weekly active user counts
router.get('/stats/dau', adminController.getDailyActiveUsers);

// GET top tracks with customizable parameters
router.get('/stats/top-tracks', adminController.getTopTracks);

console.log('Admin routes loaded');
// Contact message management routes
router.get('/messages', adminController.getMessages);
router.get('/messages/:id', adminController.getMessage);
router.patch('/messages/:id', adminController.updateMessage);
router.delete('/messages/:id', adminController.deleteMessage);

module.exports = router;
