const User = require('../models/User');
const Hit = require('../models/Hit');

// Get all users with sensitive fields filtered out
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find({}).select(
      '-password -resetPasswordToken -resetPasswordExpires',
    );
    return res.status(200).json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// Delete a user by ID
exports.deleteUser = async (req, res) => {
  const { id } = req.params;

  // Validate ID format
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }

  try {
    const userToDelete = await User.findById(id);

    // Handle user not found
    if (!userToDelete) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deleting admin users
    if (userToDelete.isAdmin) {
      return res.status(403).json({ error: 'Admin users cannot be deleted' });
    }

    // Attempt to delete the user
    await User.findByIdAndDelete(id);

    return res.status(200).json({
      message: 'User deleted successfully',
      userId: id,
    });
  } catch (error) {
    console.error('Error in delete user operation:', error);
    return res.status(500).json({ error: 'Failed to delete user' });
  }
};

// Get system statistics
exports.getStats = async (req, res) => {
  try {
    const userCount = await User.countDocuments();
    const hitsResult = await Hit.aggregate([
      {
        $group: {
          _id: null,
          totalViews: { $sum: '$hitCount' },
        },
      },
    ]);

    const totalViews = hitsResult.length > 0 ? hitsResult[0].totalViews : 0;
    const uniqueVisitors = await Hit.countDocuments();

    return res.status(200).json({
      users: {
        total: userCount,
        admins: await User.countDocuments({ isAdmin: true }),
      },
      pageViews: {
        total: totalViews,
        uniqueVisitors: uniqueVisitors,
      },
      lastUpdated: new Date(),
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
};
