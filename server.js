const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const connectDB = require('./config/db');
const viewsRoutes = require('./routes/views');

const app = express();
app.use(cors());
app.use(express.json());

connectDB().catch((err) => {
  // Log only critical DB connection errors
  console.error('MongoDB connection failed:', err);
  process.exit(1);
});

app.use('/api/views', viewsRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
