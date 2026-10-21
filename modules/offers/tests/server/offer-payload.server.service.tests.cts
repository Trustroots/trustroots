const assert: typeof import('assert/strict') = require('assert/strict');
const { ObjectId } = require('mongoose').Types;
const {
  prepareNewOffer,
  prepareOfferMutationResponse,
  prepareOfferPayload,
  prepareOfferSearchResults,
  prepareOfferUpdate,
} = require('../../server/services/offer-payload.server.service.mts');

describe('Offer API payload construction', () => {
  it('preserves both values of the hosting acknowledgement preference', () => {
    for (const enabled of [true, false]) {
      const preference = { requireHostingDescriptionAcknowledgement: enabled };
      assert.deepEqual(prepareOfferUpdate(preference), preference);
      const offer = {
        _id: 'host-offer',
        type: 'host',
        user: 'fictional-host',
        location: [12, 34],
        ...preference,
      };
      assert.deepEqual(prepareOfferPayload(offer), offer);
    }
  });
  it('projects only the public offer fields', () => {
    const offer = {
      _id: new ObjectId('111111111111111111111111'),
      type: 'host',
      status: 'yes',
      user: new ObjectId('222222222222222222222222'),
      description: 'A fictional offer.',
      noOfferDescription: 'A fictional status note.',
      maxGuests: 2,
      location: [12, 34],
      updated: '2026-01-01T12:00:00.000Z',
      validUntil: '2026-02-01T12:00:00.000Z',
      showOnlyInMyCircles: false,
      locationFuzzy: [12.1, 34.1],
      reactivateReminderSent: '2026-01-02T12:00:00.000Z',
      privateField: 'Internal data',
    };

    assert.deepEqual(prepareOfferPayload(offer), {
      _id: offer._id,
      type: offer.type,
      status: offer.status,
      user: offer.user,
      description: offer.description,
      noOfferDescription: offer.noOfferDescription,
      maxGuests: offer.maxGuests,
      location: offer.location,
      updated: offer.updated,
      validUntil: offer.validUntil,
      showOnlyInMyCircles: offer.showOnlyInMyCircles,
    });
  });

  it('preserves omitted optional offer fields', () => {
    const minimalOffer = {
      _id: 'minimal-offer',
      type: 'meet',
      user: 'fictional-member',
      location: [5, 7],
    };
    assert.deepEqual(prepareOfferPayload(minimalOffer), minimalOffer);

    const offer = {
      _id: 'offer-2',
      type: 'meet',
      status: 'yes',
      user: 'member-2',
      description: 'A fictional offer.',
      noOfferDescription: '',
      maxGuests: 1,
      location: [5, 7],
      updated: '2026-01-03T12:00:00.000Z',
      showOnlyInMyCircles: false,
    };
    assert.deepEqual(prepareOfferPayload(offer), offer);
  });

  it('selects only writable fields and includes type only on create', () => {
    const request = {
      type: 'meet',
      status: 'maybe',
      description: 'A fictional offer.',
      noOfferDescription: 'A fictional availability note.',
      maxGuests: 2,
      location: [12, 34],
      validUntil: '2026-02-01T12:00:00.000Z',
      showOnlyInMyCircles: true,
      user: 'ignored-member-id',
      locationFuzzy: [12.1, 34.1],
    };
    assert.deepEqual(prepareNewOffer(request), {
      type: 'meet',
      status: 'maybe',
      description: 'A fictional offer.',
      noOfferDescription: 'A fictional availability note.',
      maxGuests: 2,
      location: [12, 34],
      validUntil: '2026-02-01T12:00:00.000Z',
      showOnlyInMyCircles: true,
    });
    assert.deepEqual(prepareOfferUpdate(request), {
      status: 'maybe',
      description: 'A fictional offer.',
      noOfferDescription: 'A fictional availability note.',
      maxGuests: 2,
      location: [12, 34],
      validUntil: '2026-02-01T12:00:00.000Z',
      showOnlyInMyCircles: true,
    });
    assert.deepEqual(prepareOfferUpdate({ location: [12, 34] }), {
      location: [12, 34],
    });
    assert.deepEqual(prepareOfferUpdate({ status: 'yes' }), {
      status: 'yes',
    });
  });

  it('constructs the existing mutation response messages', () => {
    assert.deepEqual(prepareOfferMutationResponse('Offer saved.'), {
      message: 'Offer saved.',
    });
    assert.deepEqual(prepareOfferMutationResponse('Offer updated.'), {
      message: 'Offer updated.',
    });
    assert.deepEqual(prepareOfferMutationResponse('Offer removed.'), {
      message: 'Offer removed.',
    });
  });

  it('returns search results as GeoJSON with longitude before latitude', () => {
    assert.deepEqual(
      prepareOfferSearchResults([
        {
          type: 'Feature',
          properties: {
            id: new ObjectId('333333333333333333333333'),
            status: 'maybe',
            type: 'host',
            offer: 'host-maybe',
          },
          geometry: { type: 'Point', coordinates: [12, 34] },
        },
      ]),
      {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {
              id: '333333333333333333333333',
              status: 'maybe',
              type: 'host',
              offer: 'host-maybe',
            },
            geometry: { type: 'Point', coordinates: [34, 12] },
          },
        ],
      },
    );
  });

  it('preserves optional search properties when they are absent', () => {
    assert.deepEqual(
      prepareOfferSearchResults([
        {
          type: 'Feature',
          properties: { id: 'offer-2' },
          geometry: { type: 'Point', coordinates: [5, 7] },
        },
      ]),
      {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: { id: 'offer-2' },
            geometry: { type: 'Point', coordinates: [7, 5] },
          },
        ],
      },
    );
  });
});
