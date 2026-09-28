const moment = require('moment');

/**
 * Normalise an offer expiry using the rules shared by offer creation and updates.
 *
 * @param {String} type - Offer type ("host" or "meet")
 * @param {Date|String} validUntil - Date object or date string supplied by the user
 * @param {Object|Number} maxValidFromNow - Maximum age accepted for an expiry
 * @param {Date|String|Number} now - Current time used for range checks and fallback
 * @returns {Date|undefined} The normalised expiry, or undefined for host offers
 */
function normaliseOfferExpiry(type, validUntil, maxValidFromNow, now) {
  if (type === 'host') {
    return undefined;
  }

  const parsedValidUntil = moment(validUntil);
  const minDate = moment(now).startOf('day');
  const maxDate = moment(now)
    .add(maxValidFromNow || { days: 30 })
    // Add one extra day just to accommodate oddities from timezones
    .endOf('day');

  if (validUntil && parsedValidUntil.isValid()) {
    const validUntilEndOfDay = parsedValidUntil.clone().endOf('day');

    if (
      validUntilEndOfDay.isSameOrAfter(minDate) &&
      validUntilEndOfDay.isSameOrBefore(maxDate)
    ) {
      return parsedValidUntil.toDate();
    }
  }

  return moment(now).add(maxValidFromNow).toDate();
}

module.exports = normaliseOfferExpiry;
