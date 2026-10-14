const clientIpService = require('../../server/services/client-ip.server.service.mts');
require('should');

describe('Trusted client IP service', function () {
  it('uses the secure Passenger address when present', function () {
    clientIpService
      .getClientIpAddress({
        get: name =>
          name === '!~Passenger-Client-Address' ? '198.51.100.12' : undefined,
        ip: '127.0.0.1',
        headers: { 'x-forwarded-for': '203.0.113.50' },
      })
      .should.equal('198.51.100.12');
  });

  it('uses Express req.ip and ignores an untrusted forwarding header', function () {
    clientIpService
      .getClientIpAddress({
        get: () => undefined,
        ip: '198.51.100.13',
        headers: { 'x-forwarded-for': '203.0.113.51' },
      })
      .should.equal('198.51.100.13');
  });

  it('falls back to Express req.ip when the secure address is empty', function () {
    clientIpService
      .getClientIpAddress({
        get: () => '',
        ip: '198.51.100.14',
        headers: { 'x-forwarded-for': '203.0.113.53' },
      })
      .should.equal('198.51.100.14');
  });

  it('rejects invalid trusted-address values', function () {
    const result = clientIpService.getClientIpAddress({
      get: () => 'not-an-ip',
      ip: undefined,
      headers: { 'x-forwarded-for': '203.0.113.52' },
    });
    (result === undefined).should.be.true();
  });

  it('returns undefined when neither address is available', function () {
    const result = clientIpService.getClientIpAddress({
      get: () => undefined,
      ip: undefined,
    });
    (result === undefined).should.be.true();
  });
});
