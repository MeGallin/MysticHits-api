const Hit = require('../models/Hit');

exports.pageHits = async (req, res) => {
  // Get client IP address
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  // Check if this is a readonly request (don't increment count)
  const readonly = req.query.readonly === 'true';

  console.log('=================================================');
  console.log(`HIT REQUEST - IP: ${ip}, Readonly: ${readonly}`);
  console.log('=================================================');

  try {
    // Find or create hit record for this IP
    let hit = await Hit.findOne({ ip });

    if (!readonly) {
      if (hit) {
        // Update existing hit record
        console.log(
          `Updating existing hit for IP ${ip}, current count: ${hit.hitCount}`,
        );
        hit.hitCount += 1;
        hit.lastHitAt = Date.now();
        await hit.save();
        console.log(`Updated hit count to: ${hit.hitCount}`);
      } else {
        // Create new hit record
        try {
          console.log(`Creating new hit record for IP ${ip}`);
          const newHit = new Hit({ ip });
          await newHit.save();
          console.log(`Created new hit record with count: ${newHit.hitCount}`);
        } catch (saveError) {
          // Handle duplicate key error (race condition when multiple concurrent requests)
          if (saveError.code === 11000) {
            // MongoDB duplicate key error code
            console.log(`Duplicate key error for IP ${ip}, retrying...`);
            hit = await Hit.findOne({ ip });
            if (hit) {
              hit.hitCount += 1;
              hit.lastHitAt = Date.now();
              await hit.save();
              console.log(
                `Handled race condition, updated count to: ${hit.hitCount}`,
              );
            }
          } else {
            console.error(`Error saving hit: ${saveError.message}`);
            throw saveError;
          }
        }
      }
    } else {
      console.log(`Readonly request - not incrementing count for IP ${ip}`);
    }

    // Get both unique visitor count and total hit count
    const uniqueHitCount = await Hit.countDocuments();
    console.log(`Unique visitor count: ${uniqueHitCount}`);

    // Get total hits by summing all hitCount values
    const totalHitsAgg = await Hit.aggregate([
      { $group: { _id: null, total: { $sum: '$hitCount' } } },
    ]);

    // Extract total or default to 0 if no results
    const totalHitCount = totalHitsAgg.length > 0 ? totalHitsAgg[0].total : 0;
    console.log(`Total hit count: ${totalHitCount}`);

    // Log all hit records for debugging
    const allHits = await Hit.find();
    console.log('All hit records:');
    allHits.forEach((h) => {
      console.log(
        `- IP: ${h.ip}, Count: ${h.hitCount}, Last hit: ${h.lastHitAt}`,
      );
    });

    res.json({
      uniqueHitCount,
      totalHitCount,
    });
  } catch (error) {
    console.error(`Error processing hit: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
};
