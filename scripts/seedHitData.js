// Add this script to seed some hit data for testing
const mongoose = require('mongoose');
const Hit = require('../models/Hit');
require('dotenv').config();

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch((err) => console.error('MongoDB Connection Error:', err));

// Sample data
const seedHits = [
  {
    userId: null, // Anonymous user
    ip: '192.168.1.1',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    page: '/',
    referrer: 'https://google.com',
    hitCount: 5,
    firstHitAt: new Date(Date.now() - 86400000 * 2), // 2 days ago
    lastHitAt: new Date(), // Now
  },
  {
    userId: null,
    ip: '192.168.1.2',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS)',
    page: '/playlist',
    referrer: null,
    hitCount: 3,
    firstHitAt: new Date(Date.now() - 86400000 * 3), // 3 days ago
    lastHitAt: new Date(Date.now() - 86400000), // 1 day ago
  },
  {
    userId: null,
    ip: '192.168.1.3',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X)',
    page: '/charts',
    referrer: 'https://facebook.com',
    hitCount: 2,
    firstHitAt: new Date(Date.now() - 86400000 * 5), // 5 days ago
    lastHitAt: new Date(Date.now() - 86400000 * 2), // 2 days ago
  },
  {
    userId: null,
    ip: '192.168.1.4',
    userAgent: 'Mozilla/5.0 (Linux; Android)',
    page: '/about',
    referrer: null,
    hitCount: 1,
    firstHitAt: new Date(), // Now
    lastHitAt: new Date(), // Now
  },
];

// Seed the database
const seedDatabase = async () => {
  try {
    // Clear existing data
    await Hit.deleteMany({});
    console.log('Existing hit data cleared');

    // Insert new data
    await Hit.insertMany(seedHits);
    console.log('Sample hit data seeded!');

    // Verify data
    const count = await Hit.countDocuments();
    console.log(`Database now has ${count} hit records`);

    mongoose.connection.close();
  } catch (err) {
    console.error('Error seeding database:', err);
    mongoose.connection.close();
  }
};

seedDatabase();
