
# Basic Setup Brief for Node.js & Express API

## Project Folder Structure

```
API/
├── config/
│   └── db.js                ← MongoDB connection setup
├── controllers/
│   └── viewsController.js   ← Business logic controllers
├── models/
│   └── View.js              ← MongoDB Schema definitions
├── routes/
│   └── views.js             ← API routes
├── .env                     ← Environment variables
├── server.js                ← Main entry point
├── package.json
└── node_modules/
```

## Dependencies Installation

```bash
npm init -y
npm install express mongoose dotenv cors
```

## MongoDB Connection Setup

- Create `.env` file with:

```env
MONGO_URI=mongodb://localhost:27017/mystichits
PORT=5000
```

- Database connection logic (`config/db.js`):

```javascript
const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ MongoDB Connected Successfully');
    } catch (error) {
        console.error('❌ MongoDB connection failed:', error);
        process.exit(1);
    }
};

module.exports = connectDB;
```

## Server Setup (`server.js`)

```javascript
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
require('dotenv').config();

const viewsRoutes = require('./routes/views');

const app = express();
app.use(cors());
app.use(express.json());

connectDB();

app.use('/api/views', viewsRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});
```
