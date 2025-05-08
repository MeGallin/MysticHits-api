const crypto = require('crypto');

/**
 * Hashes IP addresses using SHA-256 + server-side salt
 * @param {string} ip - The IP address to hash
 * @returns {string} - Hashed IP (64 character hex string)
 */
const hashIp = (ip) => {
  const salt = process.env.IP_HASH_SALT || 'default-salt-change-in-production';
  return crypto.createHash('sha256').update(`${ip}${salt}`).digest('hex');
};

module.exports = { hashIp };