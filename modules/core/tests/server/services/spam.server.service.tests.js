const proxyquire = require('proxyquire');
const config = require('../../../../../config/config');

require('should');

const servicePath = '../../../server/services/spam.server.service';

/**
 * Build a spam service instance with the Akismet client stubbed so the spam
 * check never touches the network.
 */
function buildService(checkSpam) {
  class FakeAkismetClient {
    checkSpam(message) {
      return checkSpam(message);
    }
  }

  return proxyquire(servicePath, {
    'akismet-api': { AkismetClient: FakeAkismetClient },
  });
}

describe('Service: spam', function () {
  let originalEnabled;

  before(function () {
    originalEnabled = config.akismet.enabled;
  });

  after(function () {
    config.akismet.enabled = originalEnabled;
  });

  it('returns "unknown" when Akismet is disabled', async function () {
    config.akismet.enabled = false;
    const spamService = require(servicePath);
    const result = await spamService.check({ ip: '1.2.3.4' });
    result.should.equal('unknown');
  });

  it('returns "unknown" when the message has no IP', async function () {
    config.akismet.enabled = true;
    const spamService = buildService(async () => false);
    const result = await spamService.check({});
    result.should.equal('unknown');
  });

  it('returns "spam" when Akismet flags the message', async function () {
    config.akismet.enabled = true;
    const spamService = buildService(async () => true);
    const result = await spamService.check({ ip: '1.2.3.4' });
    result.should.equal('spam');
  });

  it('returns "not-spam" when Akismet clears the message', async function () {
    config.akismet.enabled = true;
    const spamService = buildService(async () => false);
    const result = await spamService.check({ ip: '1.2.3.4' });
    result.should.equal('not-spam');
  });

  it('returns "unknown" when the Akismet check throws', async function () {
    config.akismet.enabled = true;
    const spamService = buildService(async () => {
      throw new Error('Akismet unreachable');
    });
    const result = await spamService.check({ ip: '1.2.3.4' });
    result.should.equal('unknown');
  });
});
