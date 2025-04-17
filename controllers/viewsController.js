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
