import {
  createOffer,
  deleteOffer,
  getOffer,
  getOffers,
  queryOffers,
  updateOffer,
} from '../../../client/api/offers.api.js';

/** Compile-only checks for request and response contracts. */
async function checkOfferContracts() {
  const created = await createOffer({
    type: 'host',
    location: [12, 34],
    status: 'maybe',
  });
  const updated = await updateOffer('offer-id', {
    location: [12, 34],
    showOnlyInMyCircles: true,
  });
  const removed = await deleteOffer('offer-id');
  const single = await getOffer('offer-id');
  const byUser = await getOffers('member-id', ['host']);
  const results = await queryOffers({ northEastLat: 40 });
  const collection: import('../../../shared/offer.js').OfferSearchFeatureCollection =
    results;
  const offer: import('../../../shared/offer.js').OfferPayload = single;

  // @ts-expect-error Unsupported offer types must not cross the API boundary.
  await createOffer({ type: 'couch', location: [12, 34] });
  // Updates may leave location unchanged.
  await updateOffer('offer-id', { status: 'yes' });
  // @ts-expect-error Invalid statuses must be rejected.
  await updateOffer('offer-id', { location: [12, 34], status: 'available' });
  // @ts-expect-error Search returns GeoJSON rather than an offer array.
  const offerList: import('../../../shared/offer.js').OfferPayload[] = results;
  // @ts-expect-error Fuzzy-location implementation detail is never public.
  const privateLocation = single.locationFuzzy;

  return {
    created,
    updated,
    removed,
    byUser,
    collection,
    offer,
    offerList,
    privateLocation,
  };
}

void checkOfferContracts;
