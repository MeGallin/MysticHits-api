const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    console.error('❌ MONGO_URI is not defined in environment variables');
    console.error(
      'Please check your .env file and make sure MONGO_URI is set correctly',
    );
    console.error('Current directory:', __dirname);
    throw new Error('MONGO_URI is not defined');
  }

  console.log(
    'Connecting to MongoDB with URI:',
    process.env.MONGO_URI.substring(0, 20) + '...',
  );

  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000, // 10 seconds timeout
      socketTimeoutMS: 45000, // 45 seconds timeout
      family: 4, // Use IPv4, skip trying IPv6
      ssl: true,
      tls: true,
      tlsAllowInvalidCertificates: true, // For testing only, not recommended for production
    });
    console.log('✅ MongoDB Connected Successfully');
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    console.error('Error details:', error.message);
    console.error('Error name:', error.name);
    if (error.reason) {
      console.error('Error reason:', error.reason);
    }
    throw error;
  }
};

module.exports = connectDB;
