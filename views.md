# Setup for Counting Unique Views

## MongoDB Schema (`models/View.js`)

Defines how IP addresses and view counts are stored.

```javascript
const mongoose = require('mongoose');

const viewSchema = new mongoose.Schema({
  ipAddress: {
    type: String,
    required: true,
    unique: true,
  },
  viewCount: {
    type: Number,
    default: 1,
  },
  lastViewedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('View', viewSchema);
```

## Controller Logic (`controllers/viewsController.js`)

Implements logic for registering IPs and incrementing the view count.

```javascript
const View = require('../models/View');

exports.registerView = async (req, res) => {
  const ipAddress =
    req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  try {
    const view = await View.findOne({ ipAddress });

    if (view) {
      view.viewCount += 1;
      view.lastViewedAt = Date.now();
      await view.save();
    } else {
      const newView = new View({ ipAddress });
      await newView.save();
    }

    const uniqueViewCount = await View.countDocuments();
    res.json({ uniqueViewCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
```

## Route Setup (`routes/views.js`)

Defines API endpoint for registering views.  
**Note: This endpoint now requires authentication via JWT.**

```javascript
const express = require('express');
const router = express.Router();
const viewsController = require('../controllers/viewsController');
const auth = require('../middleware/auth');

router.get('/register-view', auth, viewsController.registerView);

module.exports = router;
```

## Endpoint Testing

Use an API testing tool like Postman to test the API.  
**You must include a valid JWT in the Authorization header:**

```
GET http://localhost:8000/api/views/register-view
Authorization: Bearer <your-jwt-token>
```

Example response:

```json
{
  "uniqueViewCount": 1
}
```
