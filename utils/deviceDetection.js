/**
 * Device detection utility for backend/server-side device identification
 * Based on User-Agent string analysis
 */

/**
 * Detect device type from user agent string
 * @param {string} userAgent - Browser user agent string
 * @returns {string} Device type enum value
 */
const detectDeviceTypeFromUserAgent = (userAgent) => {
  if (!userAgent) {
    return 'unknown';
  }

  const ua = userAgent.toLowerCase();

  // Smart TV detection
  if (
    ua.includes('smart-tv') ||
    ua.includes('smarttv') ||
    ua.includes('googletv') ||
    ua.includes('appletv') ||
    ua.includes('roku') ||
    ua.includes('chromecast') ||
    ua.includes('webos') ||
    ua.includes('tizen') ||
    ua.includes('netcast') ||
    ua.includes('viera')
  ) {
    return 'smart-tv';
  }

  // Speaker detection (smart speakers, audio devices)
  if (
    ua.includes('alexa') ||
    ua.includes('echo') ||
    ua.includes('googlehome') ||
    ua.includes('homepod') ||
    ua.includes('sonos') ||
    ua.includes('bose') ||
    ua.includes('spotify connect')
  ) {
    return 'speaker';
  }

  // Mobile detection (phones)
  if (
    ua.includes('mobile') ||
    (ua.includes('android') && !ua.includes('tablet')) ||
    ua.includes('iphone') ||
    ua.includes('ipod') ||
    ua.includes('blackberry') ||
    ua.includes('windows phone') ||
    (ua.includes('webos') && ua.includes('mobile'))
  ) {
    return 'mobile';
  }

  // Tablet detection
  if (
    ua.includes('tablet') ||
    ua.includes('ipad') ||
    (ua.includes('android') && !ua.includes('mobile')) ||
    ua.includes('kindle') ||
    ua.includes('silk') ||
    ua.includes('playbook') ||
    // Android tablets often don't include 'mobile' in UA
    (ua.includes('android') && ua.includes('webkit') && !ua.includes('mobile'))
  ) {
    return 'tablet';
  }

  // Everything else is considered desktop
  return 'desktop';
};

module.exports = {
  detectDeviceTypeFromUserAgent,
};
