/**
 * Aggregation helper functions for common date calculations
 * Used primarily in stat-related MongoDB aggregation pipelines
 */

/**
 * Gets the start of a day (midnight 00:00:00.000) for a given date
 * @param {Date} date - The date to get the start of day for
 * @returns {Date} Date object set to midnight of the given day
 */
const getStartOfDay = (date = new Date()) => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  return startOfDay;
};

/**
 * Gets the start of a week (Sunday midnight 00:00:00.000) for a given date
 * @param {Date} date - The date to get the start of week for
 * @returns {Date} Date object set to midnight of the Sunday of the given week
 */
const getStartOfWeek = (date = new Date()) => {
  const startOfWeek = new Date(date);
  const dayOfWeek = startOfWeek.getDay(); // 0 is Sunday, 1 is Monday, etc.
  
  // Go back to the most recent Sunday
  startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);
  
  // Set to midnight
  startOfWeek.setHours(0, 0, 0, 0);
  return startOfWeek;
};

/**
 * Gets a Date object N days in the past from a given date
 * @param {number} days - Number of days to go back
 * @param {Date} fromDate - Starting date (defaults to now)
 * @returns {Date} Date object representing the date N days ago
 */
const getDaysAgo = (days, fromDate = new Date()) => {
  const daysAgo = new Date(fromDate);
  daysAgo.setDate(daysAgo.getDate() - days);
  return daysAgo;
};

module.exports = {
  getStartOfDay,
  getStartOfWeek,
  getDaysAgo
};