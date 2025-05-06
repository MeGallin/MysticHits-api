const mongoose = require('mongoose');
const crypto = require('crypto');

const folderSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    path: { type: String, required: true }, // local sub-path OR remote URL
    created: { type: Date, default: Date.now },
  },
  { _id: true },
);

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    resetPasswordToken: {
      type: String,
    },
    resetPasswordExpires: {
      type: Date,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    folders: [folderSchema],
  },
  { timestamps: true },
);

// Instance method to create a password reset token
userSchema.methods.createPasswordReset = function () {
  // Generate a random token
  const resetToken = crypto.randomBytes(32).toString('hex');
  // Hash the token and set to resetPasswordToken
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  // Set expiration (from env or default 1 hour)
  const expiresIn = process.env.RESET_TOKEN_EXPIRES
    ? parseInt(process.env.RESET_TOKEN_EXPIRES, 10)
    : 60 * 60 * 1000; // 1 hour in ms
  this.resetPasswordExpires = Date.now() + expiresIn;
  // Return the plaintext token
  return resetToken;
};

module.exports = mongoose.model('User', userSchema);
