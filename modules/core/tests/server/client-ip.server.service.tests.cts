const clientIpService: typeof import('../../server/services/client-ip.server.service.mts') = require('../../server/services/client-ip.server.service.mts');
const assert: typeof import('node:assert/strict') = require('node:assert/strict');

type ClientIpRequest = Parameters<typeof clientIpService.getClientIpAddress>[0];

function withForwardedHeader(
  request: ClientIpRequest,
  address: string,
): ClientIpRequest & { headers: { 'x-forwarded-for': string } } {
  return { ...request, headers: { 'x-forwarded-for': address } };
}

describe('Trusted client IP service', function () {
  it('uses the secure Passenger address when present', function () {
    assert.equal(
      clientIpService.getClientIpAddress(
        withForwardedHeader(
          {
            get: (name: string) =>
              name === '!~Passenger-Client-Address'
                ? '198.51.100.12'
                : undefined,
            ip: '127.0.0.1',
          },
          '203.0.113.50',
        ),
      ),
      '198.51.100.12',
    );
  });

  it('uses Express req.ip and ignores an untrusted forwarding header', function () {
    assert.equal(
      clientIpService.getClientIpAddress(
        withForwardedHeader(
          {
            get: () => undefined,
            ip: '198.51.100.13',
          },
          '203.0.113.51',
        ),
      ),
      '198.51.100.13',
    );
  });

  it('falls back to Express req.ip when the secure address is empty', function () {
    assert.equal(
      clientIpService.getClientIpAddress(
        withForwardedHeader(
          {
            get: () => '',
            ip: '198.51.100.14',
          },
          '203.0.113.53',
        ),
      ),
      '198.51.100.14',
    );
  });

  it('rejects invalid trusted-address values', function () {
    const result = clientIpService.getClientIpAddress(
      withForwardedHeader(
        { get: () => 'not-an-ip', ip: undefined },
        '203.0.113.52',
      ),
    );
    assert.equal(result, undefined);
  });

  it('returns undefined when neither address is available', function () {
    const result = clientIpService.getClientIpAddress({
      get: () => undefined,
      ip: undefined,
    });
    assert.equal(result, undefined);
  });
});
