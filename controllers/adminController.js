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

  // Validate MongoDB ObjectId format
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }

  try {
    // First find the user to check if they exist and if they're an admin
    const userToDelete = await User.findById(id);

    // Handle user not found
    if (!userToDelete) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent deleting admin users
    if (userToDelete.isAdmin) {
      return res.status(403).json({ error: 'Admin users cannot be deleted' });
    }

    // Delete the user in a separate operation
    const result = await User.findByIdAndDelete(id);

    // Double check the deletion was successful
    if (!result) {
      throw new Error('User deletion failed');
    }

    return res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Error in delete user operation:', error);
    return res.status(500).json({ error: 'Failed to delete user' });
  }
};

// Change user role (promote/demote admin status)
exports.changeUserRole = async (req, res) => {
  const { id } = req.params;
  const { isAdmin } = req.body;

  // Validate isAdmin is boolean
  if (typeof isAdmin !== 'boolean') {
    return res.status(422).json({ error: 'isAdmin boolean required' });
  }

  // Validate MongoDB ObjectId format
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }

  try {
    // Find and update user
    const user = await User.findByIdAndUpdate(
      id,
      { isAdmin },
      {
        new: true,
        select: '-password -resetPasswordToken -resetPasswordExpires',
      },
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      data: user,
      message: `User ${isAdmin ? 'promoted to' : 'demoted from'} admin role`,
    });
  } catch (error) {
    console.error('Error changing user role:', error);
    res.status(500).json({ error: 'Failed to change user role' });
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
