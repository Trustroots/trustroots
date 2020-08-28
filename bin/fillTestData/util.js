/**
 * Adds number of days to the date and returns a new date
 *
 * @param {number} date
 * @param {number} days
 * @returns {Date} the new date object
 */
exports.addDays = function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};
