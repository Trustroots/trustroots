import { add, endOfDay, isValid, startOfDay, type Duration } from 'date-fns';

/**
 * Normalise an offer expiry using the rules shared by offer creation and updates.
 *
 * @param type Offer type ("host" or "meet")
 * @param validUntil Raw input supplied by the request, coerced with `new Date()`
 * @param maxValidFromNow Maximum age accepted for an expiry
 * @param now Current time used for range checks and fallback
 * @returns The normalised expiry, or undefined for host offers
 */
function normaliseOfferExpiry(
  type: unknown,
  validUntil: unknown,
  maxValidFromNow: Duration | undefined,
  now: Date | string | number,
): Date | undefined {
  if (type === 'host') {
    return undefined;
  }
  const maximumAge = maxValidFromNow || {
    days: 30,
  };
  // The JavaScript Date API coerces arbitrary raw request values.
  const parsedValidUntil = new Date(validUntil as string);
  // Stryker disable next-line StringLiteral: validUntilEndOfDay is always the last millisecond of a day, so it is at or after `now` exactly when it is at or after the start of that day
  const minDate = startOfDay(now);
  // Add one extra day just to accommodate oddities from timezones
  const maxDate = endOfDay(add(now, maximumAge));
  if (validUntil && isValid(parsedValidUntil)) {
    const validUntilEndOfDay = endOfDay(parsedValidUntil);
    if (validUntilEndOfDay >= minDate && validUntilEndOfDay <= maxDate) {
      return parsedValidUntil;
    }
  }
  return add(now, maximumAge);
}

export default normaliseOfferExpiry;
