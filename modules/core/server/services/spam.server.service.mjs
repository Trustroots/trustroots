import akismetApi from 'akismet-api';
import config from './../../../../config/config.mjs';
import log from './../../../../config/lib/logger.mjs';
const { AkismetClient } = akismetApi;
export const check = async message => {
  if (!config.akismet.enabled) {
    log('info', 'Akismet is not configured, spam check skipped.');
    return 'unknown';
  }
  if (!message.ip) {
    log('info', 'Akismet requires IP. Spam check skipped.');
    return 'unknown';
  }
  if (!message.useragent) {
    log('info', 'Akismet requires useragent. Spam check skipped.');
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
const defaultInterop = {
  check,
};
export default defaultInterop;
export { defaultInterop as 'module.exports' };
