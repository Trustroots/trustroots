/**
 * Pick only the fields exposed by the offer read endpoints.
 * Sanitisation and owner-versus-viewer location selection happen before this
 * projection in the controller.
 * @template Id, Timestamp
 * @param {import('../../shared/offer.js').OfferPayload<Id, Timestamp>} offer
 * @returns {import('../../shared/offer.js').OfferPayload<Id, Timestamp>}
 */
export function prepareOfferPayload(offer) {
  return {
    _id: offer._id,
    type: offer.type,
    user: offer.user,
    location: offer.location,
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

/**
 * Select writable fields from an update request.
 * @param {import('../../shared/offer.js').UpdateOfferRequest} body
 * @returns {import('../../shared/offer.js').UpdateOfferRequest}
 */
export function prepareOfferUpdate(body) {
  return {
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

/**
 * Select writable fields from a create request, including its required type.
 * @param {import('../../shared/offer.js').CreateOfferRequest} body
 * @returns {import('../../shared/offer.js').CreateOfferRequest}
 */
export function prepareNewOffer(body) {
  return {
    ...prepareOfferUpdate(body),
    location: body.location,
    type: body.type,
  };
}

/**
 * @param {import('../../shared/offer.js').OfferMutationResponse['message']} message
 * @returns {import('../../shared/offer.js').OfferMutationResponse}
 */
export function prepareOfferMutationResponse(message) {
  return { message };
}

/**
 * Build the public GeoJSON response and convert Mongo [lat, lng] points to
 * GeoJSON [lng, lat] points.
 * @template {{ toString: () => string }} Id
 * @param {import('../../shared/offer.js').OfferSearchAggregationFeature<Id>[]} features
 * @returns {import('../../shared/offer.js').OfferSearchFeatureCollection}
 */
export function prepareOfferSearchResults(features) {
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
