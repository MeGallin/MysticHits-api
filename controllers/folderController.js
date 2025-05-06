const User = require('../models/User');
const { validateUrl, validateFolderPath } = require('./playlistController');

/**
 * Helper function to validate that the user is either the owner of the resource
 * or has admin privileges
 *
 * @param {Object} req - Express request object
 * @param {string} ownerId - ID of the resource owner
 * @returns {boolean|object} - True if authorized, otherwise response object
 */
function assertOwnerOrAdmin(req, ownerId) {
  if (ownerId.toString() !== req.userId && !req.isAdmin) {
    return { status: 403, error: 'Forbidden: Access denied' };
  }
  return true;
}

/**
 * List folders for the current user or a specific user (admin only)
 *
 * @route GET /api/user/folders
 * @route GET /api/user/folders/user/:uid (admin)
 * @access Private
 */
exports.listFolders = async (req, res) => {
  try {
    const { uid } = req.params; // optional (admin view)
    const targetId = uid || req.userId;

    // Check permissions if viewing someone else's folders
    if (uid) {
      const authCheck = assertOwnerOrAdmin(req, uid);
      if (authCheck !== true) {
        return res.status(authCheck.status).json({ error: authCheck.error });
      }
    }

    const user = await User.findById(targetId, 'folders');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user.folders);
  } catch (error) {
    console.error('Error listing folders:', error);
    res.status(500).json({ error: 'Failed to list folders' });
  }
};

/**
 * Add a new folder to the current user's collection
 *
 * @route POST /api/user/folders
 * @access Private
 */
exports.addFolder = async (req, res) => {
  try {
    const { label, path } = req.body;

    // Validate required fields
    if (!label || !path) {
      return res.status(400).json({ error: 'label & path required' });
    }

    // Validate folder count (max 50 per user)
    const user = await User.findById(req.userId);
    if (user.folders && user.folders.length >= 50) {
      return res.status(400).json({ error: 'Maximum of 50 folders reached' });
    }

    // Quick path validation
    try {
      path.startsWith('http') ? validateUrl(path) : validateFolderPath(path);
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }

    // Add the new folder and return it
    const updatedUser = await User.findByIdAndUpdate(
      req.userId,
      { $push: { folders: { label, path } } },
      { new: true, select: 'folders' },
    );

    // Return just the newly added folder (last one in the array)
    const newFolder = updatedUser.folders[updatedUser.folders.length - 1];
    res.status(201).json(newFolder);
  } catch (error) {
    console.error('Error adding folder:', error);
    res.status(500).json({ error: 'Failed to add folder' });
  }
};

/**
 * Update an existing folder
 *
 * @route PATCH /api/user/folders/:id
 * @access Private
 */
exports.updateFolder = async (req, res) => {
  try {
    const { id } = req.params;
    const { label, path } = req.body;

    // Find the folder to ensure it exists and user has permission
    const user = await User.findOne(
      { 'folders._id': id },
      { 'folders.$': 1, _id: 1 },
    );

    if (!user) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    // Check if user has permission to update this folder
    const authCheck = assertOwnerOrAdmin(req, user._id);
    if (authCheck !== true) {
      return res.status(authCheck.status).json({ error: authCheck.error });
    }

    // Validate path if provided
    if (path) {
      try {
        path.startsWith('http') ? validateUrl(path) : validateFolderPath(path);
      } catch (e) {
        return res.status(400).json({ error: e.message });
      }
    }

    // Update the folder
    await User.updateOne(
      { 'folders._id': id },
      {
        $set: {
          'folders.$.label': label || user.folders[0].label,
          'folders.$.path': path || user.folders[0].path,
        },
      },
    );

    res.json({ success: true, message: 'Folder updated successfully' });
  } catch (error) {
    console.error('Error updating folder:', error);
    res.status(500).json({ error: 'Failed to update folder' });
  }
};

/**
 * Delete a folder
 *
 * @route DELETE /api/user/folders/:id
 * @access Private
 */
exports.deleteFolder = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the folder to ensure it exists
    const user = await User.findOne(
      { 'folders._id': id },
      { 'folders.$': 1, _id: 1 },
    );

    if (!user) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    // Check if user has permission to delete this folder
    const authCheck = assertOwnerOrAdmin(req, user._id);
    if (authCheck !== true) {
      return res.status(authCheck.status).json({ error: authCheck.error });
    }

    // Remove the folder
    await User.updateOne(
      { _id: user._id },
      { $pull: { folders: { _id: id } } },
    );

    res.json({ success: true, message: 'Folder deleted successfully' });
  } catch (error) {
    console.error('Error deleting folder:', error);
    res.status(500).json({ error: 'Failed to delete folder' });
  }
};

/**
 * Get playlist from a saved folder
 *
 * @route GET /api/user/folders/:id/playlist
 * @access Private
 */
exports.playFolder = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the folder
    const user = await User.findOne(
      { 'folders._id': id },
      { 'folders.$': 1, _id: 1 },
    );

    if (!user) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    // Check if user has permission to access this folder
    const authCheck = assertOwnerOrAdmin(req, user._id);
    if (authCheck !== true) {
      return res.status(authCheck.status).json({ error: authCheck.error });
    }

    const { path } = user.folders[0];

    // Get the playlist using existing playlist controller methods
    const playlistController = require('./playlistController');
    let tracks = [];

    if (path.startsWith('http')) {
      tracks = await playlistController.getPlaylistFromRemoteFolder(path);
    } else {
      tracks = await playlistController.getPlaylistFromLocalFolder(path, req);
    }

    res.json({
      success: true,
      count: tracks.length,
      data: tracks,
    });
  } catch (error) {
    console.error('Error fetching folder playlist:', error);
    res.status(500).json({ error: 'Failed to fetch playlist from folder' });
  }
};
