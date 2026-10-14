const assert: typeof import('assert/strict') = require('assert/strict');
const { execFileSync } = require('child_process');
const path: typeof import('path') = require('path');

describe('Offer API contract compiler regressions', function () {
  this.timeout(30000);
  const root = path.resolve(__dirname, '../../../..');
  const implementation =
    'modules/offers/server/services/offer-payload.server.service.mts';

  function diagnostics(
    before: string | undefined,
    after: string | undefined,
  ): Array<{ code: number; messageText: string }> {
    const output = execFileSync(
      process.execPath,
      [
        path.join(
          root,
          'modules/admin/tests/fixtures/shared-api-contract-diagnostics.js',
        ),
        JSON.stringify({
          root,
          file: before === undefined ? undefined : implementation,
          before,
          after,
        }),
      ],
      { env: { ...process.env, NODE_OPTIONS: '' }, encoding: 'utf8' },
    );
    return JSON.parse(output) as Array<{
      code: number;
      messageText: string;
    }>;
  }

  it('checks the unmodified offer payload builders', () => {
    assert.deepEqual(diagnostics(undefined, undefined), []);
  });

  it('rejects a private persisted field in the public offer projection', () => {
    const errors = diagnostics(
      'location: offer.location,',
      'location: offer.location, locationFuzzy: offer.locationFuzzy,',
    );
    assert(errors.some(error => error.code === 2353));
  });

  it('rejects an invalid status in the offer projection', () => {
    const errors = diagnostics(
      '...(offer.status === undefined ? {} : { status: offer.status }),',
      "...(offer.status === undefined ? {} : { status: 'available' }),",
    );
    assert(errors.some(error => error.code === 2322));
  });

  it('rejects a non-string public search id', () => {
    const errors = diagnostics(
      'id: feature.properties.id.toString(),',
      'id: 23,',
    );
    assert(errors.some(error => error.code === 2322));
  });
});
