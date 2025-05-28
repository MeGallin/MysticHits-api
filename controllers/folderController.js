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
        return res
          .status(authCheck.status)
          .json({ success: false, error: authCheck.error });
      }
    }

    const user = await User.findById(targetId, 'folders');

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Return with success flag and data property for consistent frontend handling
    res.json({
      success: true,
      data: user.folders || [],
    });
  } catch (error) {
    console.error('Error listing folders:', error);
    res.status(500).json({ success: false, error: 'Failed to list folders' });
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
      return res
        .status(400)
        .json({ success: false, error: 'label & path required' });
    }

    // Validate folder count (max 50 per user)
    const user = await User.findById(req.userId);
    if (user.folders && user.folders.length >= 50) {
      return res
        .status(400)
        .json({ success: false, error: 'Maximum of 50 folders reached' });
    }

    // Quick path validation
    try {
      path.startsWith('http') ? validateUrl(path) : validateFolderPath(path);
    } catch (e) {
      return res.status(400).json({ success: false, error: e.message });
    }

    // Add the new folder and return it
    const updatedUser = await User.findByIdAndUpdate(
      req.userId,
      { $push: { folders: { label, path } } },
      { new: true, select: 'folders' },
    );

    // Return just the newly added folder (last one in the array)
    const newFolder = updatedUser.folders[updatedUser.folders.length - 1];
    res.status(201).json({
      success: true,
      data: newFolder,
    });
  } catch (error) {
    console.error('Error adding folder:', error);
    res.status(500).json({ success: false, error: 'Failed to add folder' });
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
      return res
        .status(404)
        .json({ success: false, error: 'Folder not found' });
    }

    // Check if user has permission to update this folder
    const authCheck = assertOwnerOrAdmin(req, user._id);
    if (authCheck !== true) {
      return res
        .status(authCheck.status)
        .json({ success: false, error: authCheck.error });
    }

    // Validate path if provided
    if (path) {
      try {
        path.startsWith('http') ? validateUrl(path) : validateFolderPath(path);
      } catch (e) {
        return res.status(400).json({ success: false, error: e.message });
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
    res.status(500).json({ success: false, error: 'Failed to update folder' });
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
      return res
        .status(404)
        .json({ success: false, error: 'Folder not found' });
    }

    // Check if user has permission to delete this folder
    const authCheck = assertOwnerOrAdmin(req, user._id);
    if (authCheck !== true) {
      return res
        .status(authCheck.status)
        .json({ success: false, error: authCheck.error });
    }

    // Remove the folder
    await User.updateOne(
      { _id: user._id },
      { $pull: { folders: { _id: id } } },
    );

    res.json({ success: true, message: 'Folder deleted successfully' });
  } catch (error) {
    console.error('Error deleting folder:', error);
    res.status(500).json({ success: false, error: 'Failed to delete folder' });
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
      return res
        .status(404)
        .json({ success: false, error: 'Folder not found' });
    }

    // Check if user has permission to access this folder
    const authCheck = assertOwnerOrAdmin(req, user._id);
    if (authCheck !== true) {
      return res
        .status(authCheck.status)
        .json({ success: false, error: authCheck.error });
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
      data: tracks,
    });
  } catch (error) {
    console.error('Error fetching folder playlist:', error);
    res
      .status(500)
      .json({ success: false, error: 'Failed to fetch playlist from folder' });
  }
};

/**
 * Reorder folders for a user
 *
 * @route PUT /api/user/folders/reorder
 * @access Private
 */
exports.reorderFolders = async (req, res) => {
  try {
    const { folderIds } = req.body;

    if (!folderIds || !Array.isArray(folderIds) || folderIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'folderIds array is required',
      });
    }

    // Get the user with their folders
    const user = await User.findById(req.userId, 'folders');

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    // Validate that all folderIds belong to this user
    const userFolderIds = user.folders.map((folder) => folder._id.toString());
    const allIdsExist = folderIds.every((id) => userFolderIds.includes(id));

    if (!allIdsExist) {
      return res.status(400).json({
        success: false,
        error: 'One or more folder IDs are invalid',
      });
    }

    // Create a new array of folders in the specified order
    const orderedFolders = [];

    // First add folders in the requested order
    for (const id of folderIds) {
      const folder = user.folders.find((f) => f._id.toString() === id);
      if (folder) {
        orderedFolders.push(folder);
      }
    }

    // Add any folders that weren't in the reordering array at the end
    for (const folder of user.folders) {
      if (!folderIds.includes(folder._id.toString())) {
        orderedFolders.push(folder);
      }
    }

    // Save the reordered folders
    user.folders = orderedFolders;
    await user.save();

    // Return the reordered list
    res.json({
      success: true,
      data: user.folders,
      message: 'Folders reordered successfully',
    });
  } catch (error) {
    console.error('Error reordering folders:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reorder folders',
    });
  }
};

/**
 * Admin: Add a folder to a specific user's account
 *
 * @route POST /api/admin/users/:uid/folders
 * @access Admin only
 */
exports.adminAddFolderToUser = async (req, res) => {
  try {
    // Ensure user is admin
    if (!req.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Admin access required',
      });
    }

    const { uid } = req.params;
    const { label, path } = req.body;

    // Validate required fields
    if (!label || !path) {
      return res
        .status(400)
        .json({ success: false, error: 'label & path required' });
    }

    // Check if target user exists
    const targetUser = await User.findById(uid);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        error: 'Target user not found',
      });
    }

    // Validate folder count (max 50 per user)
    if (targetUser.folders && targetUser.folders.length >= 50) {
      return res
        .status(400)
        .json({
          success: false,
          error: 'Maximum of 50 folders reached for this user',
        });
    }

    // Quick path validation
    try {
      path.startsWith('http') ? validateUrl(path) : validateFolderPath(path);
    } catch (e) {
      return res.status(400).json({ success: false, error: e.message });
    }

    // Add the new folder and return it
    const updatedUser = await User.findByIdAndUpdate(
      uid,
      { $push: { folders: { label, path } } },
      { new: true, select: 'folders username email' },
    );

    // Return just the newly added folder (last one in the array)
    const newFolder = updatedUser.folders[updatedUser.folders.length - 1];
    res.status(201).json({
      success: true,
      data: newFolder,
      message: `Folder added to user ${
        updatedUser.username || updatedUser.email
      }`,
    });
  } catch (error) {
    console.error('Error adding folder to user:', error);
    res
      .status(500)
      .json({ success: false, error: 'Failed to add folder to user' });
  }
};

/**
 * Admin: Remove a folder from a specific user's account
 *
 * @route DELETE /api/admin/users/:uid/folders/:folderId
 * @access Admin only
 */
exports.adminRemoveFolderFromUser = async (req, res) => {
  try {
    // Ensure user is admin
    if (!req.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Admin access required',
      });
    }

    const { uid, folderId } = req.params;

    // Find the user and folder
    const user = await User.findOne(
      { _id: uid, 'folders._id': folderId },
      { 'folders.$': 1, username: 1, email: 1 },
    );

    if (!user) {
      return res
        .status(404)
        .json({ success: false, error: 'User or folder not found' });
    }

    // Remove the folder
    await User.updateOne(
      { _id: uid },
      { $pull: { folders: { _id: folderId } } },
    );

    res.json({
      success: true,
      message: `Folder removed from user ${user.username || user.email}`,
    });
  } catch (error) {
    console.error('Error removing folder from user:', error);
    res
      .status(500)
      .json({ success: false, error: 'Failed to remove folder from user' });
  }
};

/**
 * Admin: Get all folders for a specific user
 *
 * @route GET /api/admin/users/:uid/folders
 * @access Admin only
 */
exports.adminGetUserFolders = async (req, res) => {
  try {
    // Ensure user is admin
    if (!req.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Admin access required',
      });
    }

    const { uid } = req.params;

    const user = await User.findById(uid, 'folders username email');

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
        },
        folders: user.folders || [],
      },
    });
  } catch (error) {
    console.error('Error getting user folders:', error);
    res
      .status(500)
      .json({ success: false, error: 'Failed to get user folders' });
  }
};

/**
 * Admin: Bulk add folders to multiple users
 *
 * @route POST /api/admin/folders/bulk-add
 * @access Admin only
 */
exports.adminBulkAddFolders = async (req, res) => {
  try {
    // Ensure user is admin
    if (!req.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Admin access required',
      });
    }

    const { userIds, label, path } = req.body;

    // Validate required fields
    if (!userIds || !Array.isArray(userIds) || !label || !path) {
      return res.status(400).json({
        success: false,
        error: 'userIds array, label & path required',
      });
    }

    // Quick path validation
    try {
      path.startsWith('http') ? validateUrl(path) : validateFolderPath(path);
    } catch (e) {
      return res.status(400).json({ success: false, error: e.message });
    }

    const results = {
      successful: [],
      failed: [],
    };

    // Process each user
    for (const uid of userIds) {
      try {
        const user = await User.findById(uid);

        if (!user) {
          results.failed.push({ userId: uid, error: 'User not found' });
          continue;
        }

        // Check folder limit
        if (user.folders && user.folders.length >= 50) {
          results.failed.push({
            userId: uid,
            error: 'Maximum of 50 folders reached',
            username: user.username || user.email,
          });
          continue;
        }

        // Add folder
        await User.findByIdAndUpdate(uid, {
          $push: { folders: { label, path } },
        });

        results.successful.push({
          userId: uid,
          username: user.username || user.email,
        });
      } catch (error) {
        results.failed.push({
          userId: uid,
          error: error.message,
        });
      }
    }

    res.json({
      success: true,
      data: results,
      message: `Bulk operation completed: ${results.successful.length} successful, ${results.failed.length} failed`,
    });
  } catch (error) {
    console.error('Error in bulk add folders:', error);
    res
      .status(500)
      .json({ success: false, error: 'Failed to bulk add folders' });
  }
};
