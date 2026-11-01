const assert: typeof import('node:assert/strict') = require('node:assert/strict');
const { createHmac }: typeof import('node:crypto') = require('node:crypto');
const {
  hashIpAddress,
}: typeof import('../../server/services/ip-hash.server.service.mts') = require('../../server/services/ip-hash.server.service.mts');

describe('IP equality identifiers', () => {
  const key = 'fictional-test-key-with-at-least-32-bytes';
  it('uses domain-separated HMAC-SHA-256', () => {
    assert.equal(
      hashIpAddress('203.0.113.10', key),
      createHmac('sha256', key)
        .update('trustroots:ip:v1:203.0.113.10')
        .digest('hex'),
    );
    assert.notEqual(
      hashIpAddress('203.0.113.10', key),
      hashIpAddress('203.0.113.11', key),
    );
    assert.notEqual(
      hashIpAddress('203.0.113.10', key),
      hashIpAddress('203.0.113.10', key + 'other'),
    );
  });
  it('canonicalises IPv6 and IPv4-mapped forms', () => {
    assert.equal(
      hashIpAddress('2001:0DB8:0000:0000:0000:0000:0000:0010', key),
      hashIpAddress('2001:db8::10', key),
    );
    assert.equal(
      hashIpAddress('::ffff:203.0.113.10', key),
      hashIpAddress('203.0.113.10', key),
    );
    assert.equal(
      hashIpAddress('::ffff:cb00:710a', key),
      hashIpAddress('203.0.113.10', key),
    );
  });
  it('skips missing keys and invalid or unavailable addresses', () => {
    for (const value of [
      undefined,
      '',
      'invalid',
      '203.0.113.10, 203.0.113.11',
      'fe80::1%eth0',
    ])
      assert.equal(hashIpAddress(value, key), undefined);
    assert.equal(hashIpAddress('203.0.113.10', ''), undefined);
    assert.throws(
      () => hashIpAddress('203.0.113.10', 'short'),
      /at least 32 bytes/,
    );
  });
});
