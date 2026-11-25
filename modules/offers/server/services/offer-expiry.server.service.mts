import { add, startOfDay, type Duration } from 'date-fns';

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
  const maximumExpiry = add(now, maximumAge);
  const parsedValidUntil = validUntil
    ? new Date(validUntil as string)
    : new Date(NaN);
  const expiryDay = startOfDay(parsedValidUntil);

  // Compare calendar days, retaining the exact timestamp when it is allowed.
  if (expiryDay >= startOfDay(now) && expiryDay <= startOfDay(maximumExpiry)) {
    return parsedValidUntil;
  }
  return maximumExpiry;
}

export default normaliseOfferExpiry;
