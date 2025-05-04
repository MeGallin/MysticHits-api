const User = require('../models/User');
const Hit = require('../models/Hit');
const ContactMessage = require('../models/ContactMessage');

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

// Get all contact messages
exports.getMessages = async (req, res) => {
  try {
    const filter = req.query.filter; // 'all', 'unread', or 'important'

    let queryCondition = {};
    if (filter === 'unread') {
      queryCondition = { read: false };
    } else if (filter === 'important') {
      queryCondition = { important: true };
    }

    const messages = await ContactMessage.find(queryCondition)
      .sort({ submittedAt: -1 })
      .select('fullName email subject message submittedAt read important');

    // Transform to match frontend format
    const transformedMessages = messages.map((msg) => ({
      id: msg._id,
      name: msg.fullName,
      email: msg.email,
      subject: msg.subject,
      message: msg.message,
      date: msg.submittedAt.toISOString().split('T')[0], // Format as YYYY-MM-DD
      read: msg.read,
      important: msg.important,
    }));

    return res.status(200).json(transformedMessages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    return res.status(500).json({ error: 'Failed to fetch messages' });
  }
};

// Get a single message by ID
exports.getMessage = async (req, res) => {
  const { id } = req.params;

  // Validate MongoDB ObjectId format
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({ error: 'Invalid message ID format' });
  }

  try {
    const message = await ContactMessage.findById(id);

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Automatically mark as read when fetched individually
    if (!message.read) {
      message.read = true;
      await message.save();
    }

    const transformedMessage = {
      id: message._id,
      name: message.fullName,
      email: message.email,
      subject: message.subject,
      message: message.message,
      date: message.submittedAt.toISOString().split('T')[0],
      read: message.read,
      important: message.important,
    };

    return res.status(200).json(transformedMessage);
  } catch (error) {
    console.error('Error fetching message:', error);
    return res.status(500).json({ error: 'Failed to fetch message' });
  }
};

// Update message properties (read/important status)
exports.updateMessage = async (req, res) => {
  const { id } = req.params;
  const { read, important } = req.body;

  // Validate MongoDB ObjectId format
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({ error: 'Invalid message ID format' });
  }

  // Validate that at least one property to update is provided
  if (read === undefined && important === undefined) {
    return res.status(400).json({ error: 'No properties to update' });
  }

  try {
    // Build update object with only provided fields
    const updateData = {};
    if (read !== undefined) updateData.read = read;
    if (important !== undefined) updateData.important = important;

    const message = await ContactMessage.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const transformedMessage = {
      id: message._id,
      name: message.fullName,
      email: message.email,
      subject: message.subject,
      message: message.message,
      date: message.submittedAt.toISOString().split('T')[0],
      read: message.read,
      important: message.important,
    };

    return res.status(200).json({
      success: true,
      message: 'Message updated successfully',
      data: transformedMessage,
    });
  } catch (error) {
    console.error('Error updating message:', error);
    return res.status(500).json({ error: 'Failed to update message' });
  }
};

// Delete a message
exports.deleteMessage = async (req, res) => {
  const { id } = req.params;

  // Validate MongoDB ObjectId format
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({ error: 'Invalid message ID format' });
  }

  try {
    const result = await ContactMessage.findByIdAndDelete(id);

    if (!result) {
      return res.status(404).json({ error: 'Message not found' });
    }

    return res.status(200).json({
      success: true,
      message: 'Message deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    return res.status(500).json({ error: 'Failed to delete message' });
  }
};
