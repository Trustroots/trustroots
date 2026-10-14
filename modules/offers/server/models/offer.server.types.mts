import type { Types } from 'mongoose';
import type {
  OfferLocation,
  OfferStatus,
  OfferType,
} from '../../shared/offer.js';

/** Persisted offer fields, including the fuzzy coordinate generated from location. */
export interface OfferServerRecord {
  type: OfferType;
  status: OfferStatus;
  description?: string;
  noOfferDescription?: string;
  maxGuests?: number;
  location: OfferLocation;
  locationFuzzy: OfferLocation;
  updated?: Date;
  createdAt?: Date;
  validUntil?: Date;
  user?: Types.ObjectId;
  reactivateReminderSent?: Date;
  showOnlyInMyCircles?: boolean;
}
