const moment: typeof import('moment') = require('moment');
require('should');

const normaliseOfferExpiry: typeof import('../../server/services/offer-expiry.server.service.mts').default = require('./../../server/services/offer-expiry.server.service.mjs');

describe('Offer expiry service', () => {
  const now = new Date('2026-04-10T12:00:00.000Z');
  const maxValidFromNow = { days: 30 };

  it('uses the configured maximum age for missing, invalid, and out-of-range dates', () => {
    const fallback = moment(now).add(maxValidFromNow).toDate();

    [
      undefined,
      'not-a-date',
      '2026-04-01T08:15:00.000Z',
      '2026-06-01T08:15:00.000Z',
    ].forEach(validUntil => {
      normaliseOfferExpiry(
        'meet',
        validUntil,
        maxValidFromNow,
        now,
      )!.should.deepEqual(fallback);
    });
  });

  it('uses the thirty-day range bound when the configured maximum is absent', () => {
    const validUntil = moment(now).add(30, 'days').toDate();
    const expiry = normaliseOfferExpiry('meet', validUntil, undefined, now);

    expiry!.should.deepEqual(validUntil);
  });

  it('accepts an expiry on the last day of the allowed range', () => {
    const lastDay = moment(now).add(maxValidFromNow).endOf('day').toDate();

    normaliseOfferExpiry(
      'meet',
      lastDay,
      maxValidFromNow,
      now,
    )!.should.deepEqual(lastDay);
  });
});
