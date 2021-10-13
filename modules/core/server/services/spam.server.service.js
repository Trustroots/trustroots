const path = require('path');

const AkismetClient = require('akismet-api').AkismetClient;
const config = require(path.resolve('./config/config'));
const log = require(path.resolve('./config/lib/logger'));

exports.check = async message => {
  if (!config.akismet.enabled) {
    log('info', 'Akismet is not configured, spam check skipped.');
    return 'unknown';
  }

  if (!message.ip || !message.useragent) {
    log('info', 'Akismet requires IP and useragent. Spam check skipped.');
    return 'unknown';
  }

  // https://github.com/chrisfosterelli/akismet-api/blob/7c5720ad0b7777eb2d92e335929822d1b8d3db46/docs/client.md
  const client = new AkismetClient({
    blog: config.akismet.url,
    charset: 'UTF-8',
    key: config.akismet.key,
  });

  try {
    const isSpam = await client.checkSpam(message);

    if (isSpam) {
      return 'spam';
    }

    return 'not-spam';
  } catch (err) {
    log('error', 'Akismet spam check errored.', err);
    return 'unknown';
  }
};
