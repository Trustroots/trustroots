const moment = require('moment');
require('should');

const normaliseOfferExpiry = require('./../../server/services/offer-expiry.server.service.mjs');

describe('Offer expiry service', () => {
  const now = new Date('2026-04-10T12:00:00.000Z');
  const maxValidFromNow = { days: 30 };

  it('removes expiry from host offers', () => {
    const expiry = normaliseOfferExpiry(
      'host',
      '2026-04-20T00:00:00.000Z',
      maxValidFromNow,
      now,
    );

    (expiry === undefined).should.be.true();
  });

  it('parses an in-range meet expiry without changing its time', () => {
    const validUntil = '2026-04-20T08:15:00.000Z';
    const expiry = normaliseOfferExpiry(
      'meet',
      validUntil,
      maxValidFromNow,
      now,
    );

    expiry.should.deepEqual(new Date(validUntil));
  });

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
      ).should.deepEqual(fallback);
    });
  });

  it('uses the thirty-day range bound when the configured maximum is absent', () => {
    const validUntil = moment(now).add(30, 'days').toDate();
    const expiry = normaliseOfferExpiry('meet', validUntil, undefined, now);

    expiry.should.deepEqual(validUntil);
  });
});
