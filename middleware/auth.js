const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'changeme';

module.exports = async function (req, res, next) {
  console.log('Auth middleware called for path:', req.path);

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.log('No authorization header found');
    return res.status(401).json({ error: 'No token provided' });
  }

  if (!authHeader.startsWith('Bearer ')) {
    console.log(
      'Authorization header does not start with Bearer:',
      authHeader.substring(0, 15) + '...',
    );
    return res.status(401).json({ error: 'Invalid token format' });
  }

  const token = authHeader.split(' ')[1];
  console.log('Token received, length:', token.length);
  console.log('Token first 10 chars:', token.substring(0, 10) + '...');

  try {
    console.log('Attempting to verify token with secret');
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log('Token verified successfully, decoded payload:', {
      userId: decoded.userId,
      email: decoded.email,
      isAdmin: decoded.isAdmin,
      exp: new Date(decoded.exp * 1000).toISOString(),
    });

    req.userId = decoded.userId;

    // Get user information to check if admin
    console.log('Looking up user with ID:', decoded.userId);
    const user = await User.findById(req.userId).select('isAdmin');

    if (!user) {
      console.log('User not found in database');
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('User found, isAdmin:', user.isAdmin);
    // Add isAdmin flag to request object
    req.isAdmin = user.isAdmin || false;

    console.log('Auth middleware completed successfully');
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
