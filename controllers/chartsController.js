const axios = require('axios');
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 900 }); // 15 min

/**
 * @desc    Get Apple Music Most-Played charts for a specific storefront
 * @route   GET /api/charts/:storefront
 * @access  Public
 */
exports.getMostPlayed = async (req, res) => {
  try {
    const code = req.params.storefront.toLowerCase();

    // Validate storefront code (basic validation)
    if (!code || code.length < 2 || code.length > 5) {
      return res.status(400).json({
        success: false,
        message: 'Invalid storefront code',
      });
    }

    const cacheKey = `charts_${code}`;

    // Return cached data if available
    if (cache.has(cacheKey)) {
      return res.json(cache.get(cacheKey));
    }

    // Fetch fresh data from Apple RSS feed
    const url = `https://rss.applemarketingtools.com/api/v2/${code}/music/most-played/50/songs.json`;

    const { data } = await axios.get(url);

    if (!data || !data.feed || !data.feed.results) {
      throw new Error('Invalid response from Apple Music charts');
    }

    const tracks = data.feed.results.map((t) => ({
      title: t.name,
      artist: t.artistName,
      art: t.artworkUrl100.replace('100x100', '400x400'),
      link: t.url,
      explicit: t.contentAdvisoryRating === 'Explicit',
    }));

    const payload = {
      updated: data.feed.updated,
      tracks,
    };

    // Cache the results
    cache.set(cacheKey, payload);

    return res.json(payload);
  } catch (error) {
    console.error('Charts API Error:', error.message);

    // Handle specific errors
    if (error.response && error.response.status === 404) {
      return res.status(404).json({
        success: false,
        message: `Storefront "${req.params.storefront}" not found`,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch charts data',
      error: error.message,
    });
  }
};
