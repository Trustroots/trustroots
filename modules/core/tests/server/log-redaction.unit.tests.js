const assert = require('assert');
const proxyquire = require('proxyquire').noCallThru();
const {
  redactMetadata,
  safeError,
} = require('../../../../config/lib/log-redaction');

describe('diagnostic log redaction', () => {
  it('redacts sensitive nested fields without changing event metadata or input', () => {
    const metadata = {
      event: 'password-reset',
      count: 3,
      reason: 'provider unavailable',
      credentials: {
        password: 'private-password',
        recovery_token: 'private-token',
        authorization: 'Bearer private-secret',
      },
      message: 'private conversation',
    };

    const redacted = redactMetadata(metadata);

    assert.deepStrictEqual(redacted, {
      event: 'password-reset',
      count: 3,
      reason: 'provider unavailable',
      credentials: {
        password: '[REDACTED]',
        recovery_token: '[REDACTED]',
        authorization: '[REDACTED]',
      },
      message: '[REDACTED]',
    });
    assert.strictEqual(metadata.credentials.password, 'private-password');
    assert.strictEqual(metadata.message, 'private conversation');
  });

  it('replaces circular and over-deep metadata with safe bounded values', () => {
    const cyclic = { event: 'cycle' };
    cyclic.self = cyclic;

    let nested = { secret: 'nested secret' };
    for (let index = 0; index < 10; index += 1) nested = { nested };

    const redacted = redactMetadata({ cyclic, nested });
    assert.strictEqual(redacted.cyclic.self, '[Circular]');
    let deepest = redacted.nested;
    while (deepest && typeof deepest === 'object' && deepest.nested) {
      deepest = deepest.nested;
    }
    assert.strictEqual(deepest, '[Omitted: metadata depth limit]');
  });

  it('bounds wide objects and arrays without exposing the omitted values', () => {
    const wideObject = {};
    const wideArray = [];
    for (let index = 0; index < 1005; index += 1) {
      wideObject[`field${index}`] = `private-${index}`;
      wideArray.push(`private-${index}`);
    }

    const redactedObject = redactMetadata(wideObject);
    const redactedArray = redactMetadata(wideArray);
    assert.strictEqual(
      redactedObject['[omitted]'],
      '[Omitted: metadata entry limit]',
    );
    assert.strictEqual(
      redactedArray[redactedArray.length - 1],
      '[Omitted: metadata entry limit]',
    );
    assert.strictEqual(Object.keys(redactedObject).length, 1001);
  });

  it('omits Error messages and stacks while retaining safe classification', () => {
    const error = new Error('recovery token: private-token');
    error.code = 'ETIMEDOUT';
    error.status = 503;

    assert.deepStrictEqual(redactMetadata({ error }), {
      error: { name: 'Error', code: 'ETIMEDOUT', status: 503 },
    });

    error.code = 'private token value';
    assert.deepStrictEqual(redactMetadata(error), {
      name: 'Error',
      status: 503,
    });

    const typedError = new TypeError('sensitive type message');
    assert.deepStrictEqual(redactMetadata(typedError), { name: 'TypeError' });
  });

  it('returns a safe classification when Error metadata cannot be inspected', () => {
    const error = new Error('private error');
    const getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
    Object.getOwnPropertyDescriptor = function (object, key) {
      if (object === error) throw new Error('descriptor failure');
      return getOwnPropertyDescriptor.call(Object, object, key);
    };

    try {
      assert.deepStrictEqual(safeError(error), {
        name: 'Error',
        details: '[Uninspectable]',
      });
    } finally {
      Object.getOwnPropertyDescriptor = getOwnPropertyDescriptor;
    }
  });

  it('does not invoke accessors or throw for uninspectable objects', () => {
    let getterCalls = 0;
    const metadata = {};
    Object.defineProperty(metadata, 'diagnostic', {
      enumerable: true,
      get() {
        getterCalls += 1;
        return 'private diagnostic';
      },
    });
    Object.defineProperty(metadata, 'token', {
      enumerable: true,
      get() {
        getterCalls += 1;
        return 'private-token';
      },
    });
    const proxy = new Proxy(
      {},
      {
        ownKeys: () => {
          throw new Error('hidden');
        },
      },
    );

    const redacted = redactMetadata({ metadata, proxy });
    assert.strictEqual(redacted.metadata.token, '[REDACTED]');
    assert.strictEqual(redacted.metadata.diagnostic, '[Accessor omitted]');
    assert.strictEqual(redacted.proxy, '[Uninspectable]');
    assert.strictEqual(getterCalls, 0);
  });

  it('handles revoked and hostile array proxies without throwing', () => {
    const revoked = Proxy.revocable([], {});
    revoked.revoke();
    const hostileLength = new Proxy([], {
      get(target, key) {
        if (key === 'length') throw new Error('hidden length');
        return target[key];
      },
    });
    const hostileIndex = new Proxy(['private'], {
      getOwnPropertyDescriptor() {
        throw new Error('hidden item');
      },
    });

    assert.strictEqual(redactMetadata(revoked.proxy), '[Uninspectable]');
    assert.strictEqual(redactMetadata(hostileLength), '[Uninspectable]');
    assert.strictEqual(redactMetadata(hostileIndex), '[Uninspectable]');
  });

  it('contains failures from the binary-value classifier', () => {
    const isBuffer = Buffer.isBuffer;
    Buffer.isBuffer = () => {
      throw new Error('binary classification failed');
    };

    try {
      assert.strictEqual(redactMetadata({ safe: true }), '[Uninspectable]');
    } finally {
      Buffer.isBuffer = isBuffer;
    }
  });

  it('handles invalid dates, sparse arrays, and nested functions', () => {
    const sparse = [];
    sparse.length = 3;
    sparse[1] = () => {};
    Object.defineProperty(sparse, 0, {
      enumerable: true,
      get() {
        throw new Error('must not run');
      },
    });
    const metadata = {
      validDate: new Date('2025-01-01T00:00:00.000Z'),
      invalidDate: new Date(NaN),
      sparse,
    };

    const redacted = redactMetadata(metadata);
    assert.strictEqual(redacted.validDate, '2025-01-01T00:00:00.000Z');
    assert.strictEqual(redacted.invalidDate, '[Invalid Date]');
    assert.strictEqual(redacted.sparse[0], '[Accessor omitted]');
    assert.strictEqual(redacted.sparse[1], '[Function]');
    assert.strictEqual(redacted.sparse[2], undefined);
  });

  it('copies an own __proto__ field without changing the output prototype', () => {
    const metadata = {};
    Object.defineProperty(metadata, '__proto__', {
      enumerable: true,
      value: { password: 'private-password' },
    });

    const redacted = redactMetadata(metadata);
    assert.strictEqual(Object.getPrototypeOf(redacted), Object.prototype);
    assert.strictEqual(
      Object.prototype.hasOwnProperty.call(redacted, '__proto__'),
      true,
    );
    assert.deepStrictEqual(redacted.__proto__, { password: '[REDACTED]' });
  });

  it('wraps Winston without changing event strings, callbacks or return values', () => {
    const calls = [];
    const addCalls = [];
    const papertrailConfig = { host: 'logs.example.test', port: 1234 };
    const returnValue = { accepted: true };
    const winston = {
      transports: { Papertrail: function Papertrail() {} },
      add() {
        addCalls.push(Array.from(arguments));
      },
      log() {
        calls.push({ args: Array.from(arguments), thisValue: this });
        return returnValue;
      },
    };
    const logger = proxyquire('../../../../config/lib/logger', {
      winston,
      '../config': { log: { papertrail: papertrailConfig } },
      'winston-papertrail': { Papertrail: function Papertrail() {} },
    });
    calls.length = 0;
    assert.strictEqual(addCalls.length, 1);
    assert.strictEqual(
      papertrailConfig.logFormat('error', 'event'),
      'error: event',
    );

    const callback = () => {};
    const result = logger(
      'error',
      'Recovery event token=not-inspected',
      {
        event: 'recovery-failed',
        reset_token: 'private-token',
        error: Object.assign(new Error('private error text'), {
          code: 'EFAIL',
        }),
      },
      callback,
    );

    assert.strictEqual(result, returnValue);
    assert.strictEqual(calls.length, 1);
    assert.strictEqual(calls[0].thisValue, winston);
    assert.strictEqual(calls[0].args[0], 'error');
    assert.strictEqual(calls[0].args[1], 'Recovery event token=not-inspected');
    assert.deepStrictEqual(calls[0].args[2], {
      event: 'recovery-failed',
      reset_token: '[REDACTED]',
      error: { name: 'Error', code: 'EFAIL' },
    });
    assert.strictEqual(calls[0].args[3], callback);
  });
});
