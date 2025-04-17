const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

console.log('Starting server...');
console.log('Environment variables loaded. PORT:', process.env.PORT);
console.log('MONGO_URI exists:', !!process.env.MONGO_URI);
console.log('Current directory:', __dirname);

const connectDB = require('./config/db');
const viewsRoutes = require('./routes/views');

const app = express();
app.use(cors());
app.use(express.json());

console.log('Attempting to connect to MongoDB...');
connectDB()
  .then(() => {
    console.log('MongoDB connection successful');
  })
  .catch((err) => {
    console.error('MongoDB connection failed in server.js:', err);
  });

app.use('/api/views', viewsRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
