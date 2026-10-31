import moment from 'moment';

/**
 * Normalise an offer expiry using the rules shared by offer creation and updates.
 *
 * @param type Offer type ("host" or "meet")
 * @param validUntil Raw input supplied by the request and interpreted by moment
 * @param maxValidFromNow Maximum age accepted for an expiry
 * @param now Current time used for range checks and fallback
 * @returns The normalised expiry, or undefined for host offers
 */
function normaliseOfferExpiry(
  type: unknown,
  validUntil: unknown,
  maxValidFromNow: moment.DurationInputArg1 | undefined,
  now: moment.MomentInput,
): Date | undefined {
  if (type === 'host') {
    return undefined;
  }
  const maximumAge = maxValidFromNow || {
    days: 30,
  };
  // moment's JavaScript API has always coerced arbitrary raw request values.
  const parsedValidUntil = moment(validUntil as moment.MomentInput);
  const minDate = moment(now).startOf('day');
  const maxDate = moment(now)
    .add(maximumAge)
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
  return moment(now).add(maximumAge).toDate();
}

export default normaliseOfferExpiry;
/** @commonjs */
export { normaliseOfferExpiry as 'module.exports' };
