const Hit = require('../models/Hit');
const { hashIp } = require('../utils/ipHasher');

exports.pageHits = async (req, res) => {
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const ipHash = hashIp(ip);

  try {
    const hit = await Hit.findOne({ ipHash });

    if (hit) {
      hit.hitCount += 1;
      hit.lastHitAt = Date.now();
      await hit.save();
    } else {
      const newHit = new Hit({ ipHash });
      await newHit.save();
    }

    const uniqueHitCount = await Hit.countDocuments();
    res.json({ uniqueHitCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
