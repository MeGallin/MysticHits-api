const Hit = require('../models/Hit');

exports.pageHits = async (req, res) => {
  // Get client IP address
  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  // Session-based duplicate prevention (5 minutes window)
  const DUPLICATE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
  const now = Date.now();

  console.log('=================================================');
  console.log(`HIT REQUEST - IP: ${ip}`);
  console.log('=================================================');

  try {
    // Find existing hit record for this IP
    let hit = await Hit.findOne({ ip });
    let shouldIncrement = true;

    if (hit) {
      // Check if last hit was within the duplicate window
      const timeSinceLastHit = now - hit.lastHitAt.getTime();
      shouldIncrement = timeSinceLastHit > DUPLICATE_WINDOW_MS;

      console.log(`Existing hit found for IP ${ip}`);
      console.log(`Time since last hit: ${timeSinceLastHit}ms`);
      console.log(`Should increment: ${shouldIncrement}`);
    }

    if (shouldIncrement) {
      if (hit) {
        // Update existing hit record
        console.log(
          `Updating hit count for IP ${ip}, current: ${hit.hitCount}`,
        );
        hit.hitCount += 1;
        hit.lastHitAt = new Date(now);
        await hit.save();
        console.log(`Updated hit count to: ${hit.hitCount}`);
      } else {
        // Create new hit record
        try {
          console.log(`Creating new hit record for IP ${ip}`);
          const newHit = new Hit({ ip, lastHitAt: new Date(now) });
          await newHit.save();
          console.log(`Created new hit record with count: ${newHit.hitCount}`);
        } catch (saveError) {
          // Handle duplicate key error (race condition)
          if (saveError.code === 11000) {
            console.log(`Duplicate key error for IP ${ip}, retrying...`);
            hit = await Hit.findOne({ ip });
            if (hit) {
              const timeSinceLastHit = now - hit.lastHitAt.getTime();
              if (timeSinceLastHit > DUPLICATE_WINDOW_MS) {
                hit.hitCount += 1;
                hit.lastHitAt = new Date(now);
                await hit.save();
                console.log(
                  `Handled race condition, updated count to: ${hit.hitCount}`,
                );
              }
            }
          } else {
            console.error(`Error saving hit: ${saveError.message}`);
            throw saveError;
          }
        }
      }
    } else {
      console.log(
        `Hit within duplicate window - not incrementing count for IP ${ip}`,
      );
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

    // Return simplified response with just one count
    res.json({
      success: true,
      data: {
        hitCount: totalHitCount,
        uniqueVisitors: uniqueHitCount,
      },
    });
  } catch (error) {
    console.error(`Error processing hit: ${error.message}`);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
