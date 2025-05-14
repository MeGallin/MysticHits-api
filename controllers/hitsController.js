const Hit = require('../models/Hit');

exports.pageHits = async (req, res) => {
  // Get client IP address
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  try {
    // Find or create hit record for this IP
    let hit = await Hit.findOne({ ip });

    if (hit) {
      // Update existing hit record
      hit.hitCount += 1;
      hit.lastHitAt = Date.now();
      await hit.save();
    } else {
      // Create new hit record
      try {
        const newHit = new Hit({ ip });
        await newHit.save();
      } catch (saveError) {
        // Handle duplicate key error (race condition when multiple concurrent requests)
        if (saveError.code === 11000) {
          // MongoDB duplicate key error code
          hit = await Hit.findOne({ ip });
          if (hit) {
            hit.hitCount += 1;
            hit.lastHitAt = Date.now();
            await hit.save();
          }
        } else {
          throw saveError;
        }
      }
    }

    const uniqueHitCount = await Hit.countDocuments();
    res.json({ uniqueHitCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
