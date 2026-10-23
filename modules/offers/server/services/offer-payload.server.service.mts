import type {
  CreateOfferRequest,
  OfferMutationResponse,
  OfferPayload,
  OfferSearchAggregationFeature,
  OfferSearchFeatureCollection,
  UpdateOfferRequest,
} from '../../shared/offer.js';

const offerUpdateFields = [
  'status',
  'description',
  'noOfferDescription',
  'maxGuests',
  'location',
  'validUntil',
  'meetingStatus',
  'showOnlyInMyCircles',
] as const;

export type OfferUpdateInput = Partial<
  Record<(typeof offerUpdateFields)[number], unknown>
>;

/** Pick only the fields exposed by the offer read endpoints. */
export function prepareOfferPayload<Id, Timestamp>(
  offer: OfferPayload<Id, Timestamp>,
): OfferPayload<Id, Timestamp> {
  return {
    _id: offer._id,
    type: offer.type,
    user: offer.user,
    location: offer.location,
    ...(offer.meetingStatus === undefined
      ? {}
      : { meetingStatus: offer.meetingStatus }),
    ...(offer.status === undefined ? {} : { status: offer.status }),
    ...(offer.description === undefined
      ? {}
      : { description: offer.description }),
    ...(offer.noOfferDescription === undefined
      ? {}
      : { noOfferDescription: offer.noOfferDescription }),
    ...(offer.maxGuests === undefined ? {} : { maxGuests: offer.maxGuests }),
    ...(offer.updated === undefined ? {} : { updated: offer.updated }),
    ...(offer.validUntil === undefined ? {} : { validUntil: offer.validUntil }),
    ...(offer.showOnlyInMyCircles === undefined
      ? {}
      : { showOnlyInMyCircles: offer.showOnlyInMyCircles }),
  };
}

/** Select writable fields from an update request. */
export function prepareOfferUpdate(
  body: UpdateOfferRequest,
): UpdateOfferRequest {
  return {
    ...(body.meetingStatus === undefined
      ? {}
      : { meetingStatus: body.meetingStatus }),
    ...(body.status === undefined ? {} : { status: body.status }),
    ...(body.description === undefined
      ? {}
      : { description: body.description }),
    ...(body.noOfferDescription === undefined
      ? {}
      : { noOfferDescription: body.noOfferDescription }),
    ...(body.maxGuests === undefined ? {} : { maxGuests: body.maxGuests }),
    ...(body.location === undefined ? {} : { location: body.location }),
    ...(body.validUntil === undefined ? {} : { validUntil: body.validUntil }),
    ...(body.showOnlyInMyCircles === undefined
      ? {}
      : { showOnlyInMyCircles: body.showOnlyInMyCircles }),
  };
}

/** Pick writable fields from an unvalidated HTTP body for Mongoose casting. */
export function prepareOfferUpdateInput(
  body: Record<string, unknown>,
): OfferUpdateInput {
  const update: OfferUpdateInput = {};
  for (const field of offerUpdateFields) {
    if (body[field] !== undefined) update[field] = body[field];
  }
  return update;
}

/** Preserve the legacy create path, passing raw writable values to Mongoose. */
export function prepareNewOfferInput(
  body: Record<string, unknown>,
): OfferUpdateInput & { type?: unknown } {
  return { ...prepareOfferUpdateInput(body), type: body.type };
}

/** Select writable fields from a create request, including its required type. */
export function prepareNewOffer(body: CreateOfferRequest): CreateOfferRequest {
  return {
    ...prepareOfferUpdate(body),
    location: body.location,
    type: body.type,
  };
}

export function prepareOfferMutationResponse(
  message: OfferMutationResponse['message'],
): OfferMutationResponse {
  return { message };
}

/** Build public GeoJSON and convert Mongo [lat, lng] to GeoJSON [lng, lat]. */
export function prepareOfferSearchResults<Id extends { toString(): string }>(
  features: OfferSearchAggregationFeature<Id>[],
): OfferSearchFeatureCollection {
  return {
    features: features.map(feature => ({
      type: 'Feature',
      properties: {
        id: feature.properties.id.toString(),
        ...(feature.properties.status === undefined
          ? {}
          : { status: feature.properties.status }),
        ...(feature.properties.type === undefined
          ? {}
          : { type: feature.properties.type }),
        ...(feature.properties.offer === undefined
          ? {}
          : { offer: feature.properties.offer }),
      },
      geometry: {
        type: 'Point',
        coordinates: [
          feature.geometry.coordinates[1],
          feature.geometry.coordinates[0],
        ],
      },
    })),
    type: 'FeatureCollection',
  };
}
