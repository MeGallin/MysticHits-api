const Hit = require('../models/Hit');

/**
 * @desc Seed hit data for demonstration purposes
 * @route POST /api/admin/seed/hit-data
 * @access Private/Admin
 */
exports.seedHitData = async (req, res) => {
  try {
    // First check if we already have hits in the database
    const existingHits = await Hit.countDocuments();

    if (existingHits > 0) {
      return res.status(400).json({
        error:
          'Hit data already exists in the database. Clear existing data first if you want to reseed.',
      });
    }

    // Sample pages to create hits for
    const pages = [
      { path: '/', name: 'Home' },
      { path: '/playlist', name: 'Playlist' },
      { path: '/charts', name: 'Charts' },
      { path: '/about', name: 'About' },
      { path: '/contact', name: 'Contact' },
      { path: '/profile', name: 'Profile' },
      { path: '/search', name: 'Search' },
    ];

    // Sample user agents
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (Linux; Android 10; SM-G960U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
    ];

    // Sample referrers
    const referrers = [
      'https://google.com',
      'https://facebook.com',
      'https://twitter.com',
      'https://instagram.com',
      null,
    ];

    // Create sample IP addresses
    const generateIp = () => {
      return `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(
        Math.random() * 255,
      )}`;
    };

    const hits = [];
    const now = new Date();

    // Create hits for the past 30 days with varying popularity
    for (let i = 0; i < 30; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      // Generate more hits for more recent dates and weekends
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const daysAgo = i;
      const hitCountMultiplier = Math.max(0.5, (30 - daysAgo) / 30); // More recent = more hits
      const weekendMultiplier = isWeekend ? 1.5 : 1;

      // Create different number of hits for each page
      for (const page of pages) {
        // Home page gets more hits than others
        const baseHitCount = page.path === '/' ? 50 : 20;

        // Calculate hits for this page on this day
        const hitsForPage = Math.floor(
          baseHitCount *
            hitCountMultiplier *
            weekendMultiplier *
            (0.8 + Math.random() * 0.4),
        );

        // Create multiple hit records per page (simulating different users/visits)
        for (let j = 0; j < Math.ceil(hitsForPage / 10); j++) {
          // Each hit record represents multiple hits (hitCount)
          hits.push({
            page: page.path,
            ip: generateIp(),
            userAgent:
              userAgents[Math.floor(Math.random() * userAgents.length)],
            referrer: referrers[Math.floor(Math.random() * referrers.length)],
            hitCount: Math.min(10, hitsForPage - j * 10), // Up to 10 hits per record
            firstHitAt: date,
            lastHitAt: date,
          });
        }
      }
    }

    // Insert the hits into the database
    await Hit.insertMany(hits);

    res.status(201).json({
      success: true,
      message: `Successfully seeded ${hits.length} hit records`,
      hitsCreated: hits.length,
    });
  } catch (err) {
    console.error('Error seeding hit data:', err);
    res.status(500).json({
      error: 'Failed to seed hit data',
      details: err.message,
    });
  }
};
