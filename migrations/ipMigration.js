// filepath: c:/xampp/htdocs/WebSitesDesigns/developments/cline-test/mystickHitsv1.0/API/migrations/ipMigration.js
/**
 * Migration script to handle the transition from ipHash to direct IP storage
 * This script will:
 * 1. Clear the Hit collection to reset hit tracking
 * 2. Drop any unique index constraints that might conflict
 */

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');

async function migrateIpData() {
  try {
    console.log('Connecting to database...');
    await connectDB();

    // Reference to the Hit collection
    const db = mongoose.connection;
    const hitCollection = db.collection('hits');

    console.log('Clearing existing hit data...');
    // Drop all documents in the Hit collection
    await hitCollection.deleteMany({});

    console.log('Creating new index for IP field...');
    // Create a new index for the ip field
    await hitCollection.createIndex({ ip: 1 }, { unique: true });

    console.log('Migration completed successfully');

    // Update other collections if needed
    // This is just a clean restart for hit tracking
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    console.log('Closing database connection...');
    await mongoose.connection.close();
    process.exit(0);
  }
}

migrateIpData();
