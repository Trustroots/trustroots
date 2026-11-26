import assert from 'node:assert/strict';
import { parseHostingDetails } from '../../server/services/hosting-details.server.service.mts';

describe('Hosting message details validation', () => {
  it('keeps ordinary messages and unknown visit dates optional', () => {
    assert.equal(parseHostingDetails(undefined), undefined);
    assert.deepEqual(parseHostingDetails({ guests: 1, internal: true }), {
      guests: 1,
    });
    assert.deepEqual(parseHostingDetails({ guests: 100 }), { guests: 100 });
  });

  it('accepts an actual leap day and keeps calendar dates unchanged', () => {
    const details = {
      guests: 2,
      arrival: '2028-02-29',
      departure: '2028-03-01',
    };
    assert.deepEqual(parseHostingDetails(details), details);
  });

  for (const value of [null, true, 'hosting', [], 1]) {
    it(`rejects a non-object visit payload ${JSON.stringify(value)}`, () => {
      assert.throws(() => parseHostingDetails(value), {
        message: 'Invalid hosting details.',
      });
    });
  }

  for (const value of [
    {},
    { guests: '1' },
    { guests: NaN },
    { guests: 1.5 },
    { guests: 0 },
    { guests: 101 },
  ]) {
    it(`rejects invalid visit data ${JSON.stringify(value)}`, () => {
      assert.throws(() => parseHostingDetails(value), {
        message: 'Guest count must be a whole number from 1 to 100.',
      });
    });
  }

  for (const [arrival, departure] of [
    [undefined, '2028-03-01'],
    ['2028-02-29', undefined],
    [null, '2028-03-01'],
    [{ toString: null }, '2028-03-01'],
    ['2028-2-29', '2028-03-01'],
    ['2028-02-29 trailing text', '2028-03-01'],
    ['2028-02-29\n', '2028-03-01'],
    ['2027-02-29', '2027-03-01'],
    ['2028-13-01', '2029-01-01'],
    ['2028-02-29', '2028-02-30'],
    ['2028-02-29', '2028-02-29'],
    ['2028-03-02', '2028-03-01'],
  ]) {
    it(`rejects invalid date range ${JSON.stringify([arrival, departure])}`, () => {
      assert.throws(
        () => parseHostingDetails({ guests: 1, arrival, departure }),
        {
          message:
            'Choose valid arrival and departure dates, with departure after arrival.',
        },
      );
    });
  }
});
