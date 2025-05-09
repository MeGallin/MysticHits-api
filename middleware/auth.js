const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

module.exports = async function (req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'No token provided' });
  }

  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Invalid token format' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    req.userId = decoded.userId;

    // Get user information to check if admin
    const user = await User.findById(req.userId).select('isAdmin');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Add isAdmin flag to request object
    req.isAdmin = user.isAdmin || false;

    next();
  } catch (err) {
    console.error('Auth middleware error details:', {
      name: err.name,
      message: err.message,
      stack: err.stack,
    });

    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }

    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
