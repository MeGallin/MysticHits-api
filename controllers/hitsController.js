const Hit = require('../models/Hit');

exports.pageHits = async (req, res) => {
  const ipAddress =
    req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  try {
    const hit = await Hit.findOne({ ipAddress });

    if (hit) {
      hit.hitCount += 1;
      hit.lastHitAt = Date.now();
      await hit.save();
    } else {
      const newHit = new Hit({ ipAddress });
      await newHit.save();
    }

    const uniqueHitCount = await Hit.countDocuments();
    res.json({ uniqueHitCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
