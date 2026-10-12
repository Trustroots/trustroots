const sinon = require('sinon');
const { AkismetClient } = require('akismet-api');
const config = require('./../../../../../config/config.mjs');

require('should');

const servicePath = './../../../server/services/spam.server.service.mjs';

/**
 * Stub Akismet's shared client prototype so checks never touch the network.
 */
function stubCheckSpam(checkSpam) {
  return sinon.stub(AkismetClient.prototype, 'checkSpam').callsFake(checkSpam);
}

describe('Service: spam', function () {
  let originalEnabled;

  before(function () {
    originalEnabled = config.akismet.enabled;
  });

  afterEach(function () {
    sinon.restore();
  });

  after(function () {
    config.akismet.enabled = originalEnabled;
  });

  it('exposes the same default service through CommonJS and ESM', async function () {
    const commonJsService = require(servicePath);
    const esmService = await import(
      '../../../server/services/spam.server.service.mjs'
    );

    commonJsService.should.equal(esmService.default);
    esmService.check.should.equal(esmService.default.check);
  });

  it('returns "unknown" when Akismet is disabled', async function () {
    config.akismet.enabled = false;
    const spamService = require(servicePath);
    const result = await spamService.check({ ip: '1.2.3.4' });
    result.should.equal('unknown');
  });

  it('returns "unknown" when the message has no IP', async function () {
    config.akismet.enabled = true;
    stubCheckSpam(async () => false);
    const spamService = require(servicePath);
    const result = await spamService.check({});
    result.should.equal('unknown');
  });

  it('returns "unknown" when the message has no useragent', async function () {
    config.akismet.enabled = true;
    const checkSpam = stubCheckSpam(async () => false);
    const spamService = require(servicePath);
    const result = await spamService.check({ ip: '1.2.3.4' });
    result.should.equal('unknown');
    checkSpam.called.should.be.false();
  });

  it('returns "spam" when Akismet flags the message', async function () {
    config.akismet.enabled = true;
    stubCheckSpam(async () => true);
    const spamService = require(servicePath);
    const result = await spamService.check({
      ip: '1.2.3.4',
      useragent: 'Unit test agent',
    });
    result.should.equal('spam');
  });

  it('returns "not-spam" when Akismet clears the message', async function () {
    config.akismet.enabled = true;
    stubCheckSpam(async () => false);
    const spamService = require(servicePath);
    const result = await spamService.check({
      ip: '1.2.3.4',
      useragent: 'Unit test agent',
    });
    result.should.equal('not-spam');
  });

  it('returns "unknown" when the Akismet check throws', async function () {
    config.akismet.enabled = true;
    stubCheckSpam(async () => {
      throw new Error('Akismet unreachable');
    });
    const spamService = require(servicePath);
    const result = await spamService.check({
      ip: '1.2.3.4',
      useragent: 'Unit test agent',
    });
    result.should.equal('unknown');
  });
});
