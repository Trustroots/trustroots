import { add, addDays, endOfDay, startOfDay } from 'date-fns';
import 'should';

import normaliseOfferExpiry from './../../server/services/offer-expiry.server.service.mts';

describe('Offer expiry service', () => {
  const now = new Date('2026-04-10T12:00:00.000Z');
  const maxValidFromNow = { days: 30 };

  it('uses the configured maximum age for missing, invalid, and out-of-range dates', () => {
    const fallback = add(now, maxValidFromNow);

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
    const validUntil = addDays(now, 30);
    const expiry = normaliseOfferExpiry('meet', validUntil, undefined, now);

    expiry!.should.deepEqual(validUntil);
  });

  it('accepts an expiry on the first day of the allowed range', () => {
    const firstDay = startOfDay(now);

    normaliseOfferExpiry(
      'meet',
      firstDay,
      maxValidFromNow,
      now,
    )!.should.deepEqual(firstDay);
  });

  it('treats a zero timestamp as absent', () => {
    const epoch = new Date(0);

    normaliseOfferExpiry('meet', 0, maxValidFromNow, epoch)!.should.deepEqual(
      add(epoch, maxValidFromNow),
    );
  });

  it('accepts an expiry on the last day of the allowed range', () => {
    const lastDay = endOfDay(add(now, maxValidFromNow));

    normaliseOfferExpiry(
      'meet',
      lastDay,
      maxValidFromNow,
      now,
    )!.should.deepEqual(lastDay);
  });
});
