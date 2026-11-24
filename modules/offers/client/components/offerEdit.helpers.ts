import DOMPurify from 'dompurify';
import { DEFAULT_LOCATION } from '@/modules/core/client/utils/constants';
import type { OfferLocation } from '../../shared/offer';

export function hasHostingLocation(
  location: unknown,
): location is OfferLocation {
  if (!Array.isArray(location) || location.length !== 2) return false;

  const [latitude, longitude] = location;
  return (
    Number.isFinite(latitude) &&
    Math.abs(latitude) <= 90 &&
    Number.isFinite(longitude) &&
    Math.abs(longitude) <= 180 &&
    (latitude !== DEFAULT_LOCATION.lat || longitude !== DEFAULT_LOCATION.lng)
  );
}

export function plainTextLength(value = ''): number {
  const fragment = DOMPurify.sanitize(value, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    RETURN_DOM_FRAGMENT: true,
  });
  return (fragment.textContent || '').trim().length;
}
