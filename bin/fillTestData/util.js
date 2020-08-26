/**
 * This generates a random integer between 0 and max - 1 inclusively
 *
 * @param {number} max The max value to use to generate the random integer
 * @returns random integer between 0 and max - 1
 */
exports.random = function random(max) {
  return Math.floor(Math.random() * max);
};

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
