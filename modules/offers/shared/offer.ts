export type MeetingStatus = 'yes' | 'maybe' | 'no' | 'not-set';
export type OfferType = 'host' | 'meet';
export type OfferStatus = 'yes' | 'maybe' | 'no';

export type OfferLocation = [latitude: number, longitude: number];
export type GeoJsonPointCoordinates = [longitude: number, latitude: number];

export interface OfferEditableFields {
  status?: OfferStatus;
  description?: string;
  noOfferDescription?: string;
  maxGuests?: number;
  location?: OfferLocation;
  validUntil?: string | number | Date;
  meetingStatus?: MeetingStatus;
  volunteering?: boolean;
  showOnlyInMyCircles?: boolean;
  requireHostingDescriptionAcknowledgement?: boolean;
}

/** Request payload accepted by POST /api/offers. */
export interface CreateOfferRequest extends OfferEditableFields {
  type: OfferType;
  location: OfferLocation;
}

/** Request payload accepted by PUT /api/offers/:offerId. */
export type UpdateOfferRequest = OfferEditableFields;

export interface OfferTribe<Id = string> {
  _id: Id;
  slug?: string;
  label?: string;
  count?: number;
  image?: string;
  color?: string;
}

/** Listing fields populated on the owner for GET /api/offers/:offerId. */
export interface OfferMember<Id = string, Timestamp = string> {
  _id: Id;
  username: string;
  displayName?: string;
  avatar?: string;
  birthdate?: Timestamp | null;
  gender?: string;
  tagline?: string;
  member?: { tribe: OfferTribe<Id> }[];
}

/** Sanitised offer returned by the read-by-user endpoint. */
export interface OfferPayload<Id = string, Timestamp = string> {
  _id: Id;
  type: OfferType;
  user: Id | OfferMember<Id, Timestamp>;
  /** Precise for the owner and fuzzy for other viewers. */
  location: OfferLocation;
  status?: OfferStatus;
  description?: string;
  noOfferDescription?: string;
  maxGuests?: number;
  updated?: Timestamp;
  validUntil?: Timestamp;
  meetingStatus?: MeetingStatus;
  volunteering?: boolean;
  showOnlyInMyCircles?: boolean;
  requireHostingDescriptionAcknowledgement?: boolean;
}

/** Populated read-one response from GET /api/offers/:offerId. */
export type OfferReadPayload<Id = string, Timestamp = string> = Omit<
  OfferPayload<Id, Timestamp>,
  'user'
> & { user: OfferMember<Id, Timestamp> };

export type OfferSearchOfferKey = 'host-maybe' | 'host-yes' | 'meet-yes';

export interface OfferSearchFeatureProperties {
  id: string;
  status?: OfferStatus;
  type?: OfferType;
  offer?: OfferSearchOfferKey | null;
}

export interface OfferSearchFeature {
  type: 'Feature';
  properties: OfferSearchFeatureProperties;
  geometry: {
    type: 'Point';
    coordinates: GeoJsonPointCoordinates;
  };
}

/** Mongo aggregation form, whose point order is latitude then longitude. */
export interface OfferSearchAggregationFeature<Id = string> {
  type: 'Feature';
  properties: Omit<OfferSearchFeatureProperties, 'id'> & { id: Id };
  geometry: {
    type: 'Point';
    coordinates: OfferLocation;
  };
}

/** GeoJSON returned by GET /api/offers. */
export interface OfferSearchFeatureCollection {
  type: 'FeatureCollection';
  features: OfferSearchFeature[];
}

export type PlaceHostSort = 'name' | 'activity' | 'experiences';
export type PlaceHostActivity =
  | 'past-month'
  | 'past-six-months'
  | 'past-two-years'
  | 'older';

export interface PlaceHostResult<Id = string, Timestamp = string> {
  _id: Id;
  type: 'host';
  user: Omit<OfferMember<Id, Timestamp>, 'birthdate'>;
  location: OfferLocation;
  status?: OfferStatus;
  volunteering?: boolean;
  age?: number;
  activity: PlaceHostActivity;
  experienceCount: number;
}

export interface PlaceHostPage<Id = string, Timestamp = string> {
  offers: PlaceHostResult<Id, Timestamp>[];
  nextOffset?: number;
}

export interface OfferMutationResponse {
  message: 'Offer saved.' | 'Offer updated.' | 'Offer removed.';
  /** Present on successful hosting offer creation. */
  _id?: string;
}
