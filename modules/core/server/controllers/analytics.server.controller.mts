import log from './../../../../config/lib/logger.mjs';
interface UTMParameters {
  source?: unknown;
  medium?: unknown;
  campaign?: unknown;
  term?: unknown;
  content?: unknown;
}

/**
 * Module dependencies.
 */

/**
 * Append UTM parameters to a URL so Umami can attribute visits to a campaign
 * @param {string} trackUrl - Original URL to modify
 * @param {Object[]} utmParams - UTM Parameters to append to the URL
 * @param {string} utmParams[].source - UTM source value
 * @param {string} utmParams[].medium - UTM medium value
 * @param {string} utmParams[].campaign - UTM campaign value
 * @param {string=} utmParams[].term - UTM term value
 * @param {string=} utmParams[].content - UTM content value
 * @returns {string} - URL appended with UTM parameters, e.g. `https://www.trustroots.org/?utm_source=transactional_email&utm_medium=email&utm_campaign=password_reset_email`
 *
 * ---
 *
 * Source, medium and campaign are required; term and content are optional.
 * @link https://docs.umami.is/docs/utm
 *
 * ---
 *
 * Modified from alexandru.topliceanu's example:
 * @link http://stackoverflow.com/a/9735852/1984644
 * @link http://nodejs.org/api/url.html#url_url_format_urlobj
 *
 * @esmNamed
 */
export function appendUTMParams(
  trackUrl?: string,
  utmParams?: UTMParameters | null,
): string {
  if (
    !trackUrl ||
    !utmParams ||
    !utmParams.source ||
    !utmParams.medium ||
    !utmParams.campaign
  ) {
    log('error', 'utmTrackify() missing one of the required variables.', {
      hasTrackUrl: Boolean(trackUrl),
      hasSource: Boolean(utmParams && utmParams.source),
      hasMedium: Boolean(utmParams && utmParams.medium),
      hasCampaign: Boolean(utmParams && utmParams.campaign),
    });
    return trackUrl || '';
  }

  let parsed;
  let isRelative = false;
  try {
    parsed = new URL(trackUrl);
  } catch {
    try {
      parsed = new URL(trackUrl, 'http://relative.invalid');
      isRelative = true;
    } catch {
      return trackUrl;
    }
  }

  // Append required UTM parameters
  parsed.searchParams.set('utm_source', String(utmParams.source));
  parsed.searchParams.set('utm_medium', String(utmParams.medium));
  parsed.searchParams.set('utm_campaign', String(utmParams.campaign));

  // Optional UTM parameters
  if (utmParams.term) {
    parsed.searchParams.set('utm_term', String(utmParams.term));
  }
  if (utmParams.content) {
    parsed.searchParams.set('utm_content', String(utmParams.content));
  }

  parsed.search = parsed.searchParams.toString().replace(/\+/g, '%20');
  return isRelative
    ? `${parsed.pathname}${parsed.search}${parsed.hash}`
    : parsed.toString();
}
const defaultExport = { appendUTMParams };
export default defaultExport;
/** @commonjs */
export { defaultExport as 'module.exports' };
