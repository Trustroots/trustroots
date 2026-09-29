const assert = require('node:assert/strict');
const csrfProtection = require('../../../../config/lib/csrf-protection');

describe('CSRF origin protection', () => {
  const middleware = csrfProtection({
    domain: 'trustroots.example',
    https: true,
    csrfAllowedOrigins: ['http://localhost:4300/'],
  });

  function request(method, path, headers = {}) {
    const lowerCaseHeaders = Object.fromEntries(
      Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
    );

    return {
      method,
      path,
      get(name) {
        return lowerCaseHeaders[name.toLowerCase()];
      },
    };
  }

  function check(req) {
    const response = {
      statusCode: 200,
      body: null,
      status(statusCode) {
        this.statusCode = statusCode;
        return this;
      },
      send(body) {
        this.body = body;
        return this;
      },
    };
    let continued = false;

    middleware(req, response, () => {
      continued = true;
    });

    return { ...response, continued };
  }

  it('allows safe methods and explicitly exempt report and webhook routes', () => {
    assert.equal(check(request('GET', '/api/users')).continued, true);

    for (const path of [
      '/api/report-csp-violation',
      '/api/report-expect-ct-violation',
      '/api/sparkpost/webhook',
    ]) {
      assert.equal(
        check(request('POST', path, { Origin: 'https://attacker.example' }))
          .continued,
        true,
      );
    }

    let continued = false;
    csrfProtection({ domain: 'localhost:3000', https: false })(
      request('POST', '/api/users', { Origin: 'http://localhost:3000' }),
      { status: () => ({ send: () => {} }) },
      () => {
        continued = true;
      },
    );
    assert.equal(continued, true);
  });

  it('accepts configured origins and rejects foreign or malformed origins', () => {
    assert.equal(
      check(
        request('PUT', '/api/users', { Origin: 'https://trustroots.example' }),
      ).continued,
      true,
    );
    assert.equal(
      check(request('POST', '/api/users', { Origin: 'http://localhost:4300' }))
        .continued,
      true,
    );
    assert.equal(
      check(
        request('POST', '/api/users', {
          Origin: 'https://attacker.example',
        }),
      ).statusCode,
      403,
    );
    assert.equal(
      check(request('POST', '/api/users', { Origin: 'null' })).statusCode,
      403,
    );
    assert.equal(
      check(
        request('POST', '/api/users', {
          Origin: 'https://trustroots.example/',
        }),
      ).statusCode,
      403,
    );
  });

  it('rejects non-same-origin Fetch Metadata values', () => {
    assert.equal(
      check(request('POST', '/api/users', { 'Sec-Fetch-Site': 'same-origin' }))
        .continued,
      true,
    );
    assert.equal(
      check(request('POST', '/api/users', { 'Sec-Fetch-Site': 'same-site' }))
        .statusCode,
      403,
    );
  });

  it('requires JSON content or a marker for originless API mutations', () => {
    assert.equal(check(request('POST', '/api/auth/signout')).statusCode, 403);
    assert.equal(
      check(
        request('POST', '/api/auth/signout', {
          'X-Trustroots-Request': '1',
        }),
      ).continued,
      true,
    );
    assert.equal(
      check(
        request('POST', '/api/users', {
          'Content-Type': 'application/x-www-form-urlencoded',
        }),
      ).statusCode,
      403,
    );
    assert.equal(
      check(
        request('POST', '/api/users', {
          'Content-Type': 'text/plain; charset=utf-8',
        }),
      ).statusCode,
      403,
    );
    assert.equal(check(request('POST', '/api/users')).statusCode, 403);
    assert.equal(
      check(
        request('POST', '/api/users', {
          'Content-Type': 'application/xml',
        }),
      ).statusCode,
      403,
    );
    assert.equal(
      check(
        request('POST', '/api/users', {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Trustroots-Request': '1',
        }),
      ).continued,
      true,
    );
    assert.equal(
      check(
        request('POST', '/api/users', {
          'Content-Type': 'application/json',
        }),
      ).continued,
      true,
    );
    assert.equal(
      check(
        request('PATCH', '/api/users', {
          'Content-Type': 'application/problem+json',
        }),
      ).continued,
      true,
    );
    assert.equal(
      check(request('DELETE', '/api/users', { 'X-Trustroots-Request': '1' }))
        .continued,
      true,
    );
    assert.equal(
      check(
        request('POST', '/support', {
          'Content-Type': 'application/x-www-form-urlencoded',
        }),
      ).continued,
      true,
    );
  });

  it('requires a marker on multipart mutations, including same-origin uploads', () => {
    const headers = {
      Origin: 'https://trustroots.example',
      'Content-Type': 'multipart/form-data; boundary=sample',
    };

    assert.equal(
      check(request('POST', '/api/users-avatar', headers)).statusCode,
      403,
    );
    assert.equal(
      check(
        request('POST', '/api/users-avatar', {
          ...headers,
          'X-Trustroots-Request': '1',
        }),
      ).continued,
      true,
    );
  });
});
