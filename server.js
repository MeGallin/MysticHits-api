const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

const connectDB = require('./config/db');
const hitsRoutes = require('./routes/hits');
const authRoutes = require('./routes/auth');
const contactRoutes = require('./routes/contact');
const playlistRoutes = require('./routes/playlist');

const app = express();
app.use(cors());
app.use(express.json());

connectDB().catch((err) => {
  // Log only critical DB connection errors
  console.error('MongoDB connection failed:', err);
  process.exit(1);
});

app.use('/api/auth', authRoutes);
app.use('/api/hits', hitsRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/playlist', playlistRoutes);

const PORT = process.env.PORT || 8000;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

module.exports = app;
