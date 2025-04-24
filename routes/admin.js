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

// GET system statistics - protected for admins only
router.get('/stats', adminController.getStats);

module.exports = router;
