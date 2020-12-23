/**
 * Module dependencies.
 */
const url = require('url');
const path = require('path');
const log = require(path.resolve('./config/lib/logger'));

/**
 * Append UTM parameters to URL for Analytics
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
 * From @link https://support.google.com/analytics/answer/1033867?hl=en#more_information_and_examples_for_each_parameter
 *
 * More information and examples for each parameter
 * Campaign Source (utm_source)
 *
 * Required. Use utm_source to identify a search engine, newsletter name, or other source.
 * Example: utm_source=google
 * Campaign Medium (utm_medium)
 *
 * Required. Use utm_medium to identify a medium such as email or cost-per- click.
 * Example: utm_medium=cpc
 * Campaign Term (utm_term)
 *
 * Used for paid search. Use utm_term to note the keywords for this ad.
 * Example: utm_term=running+shoes
 * Campaign Content (utm_content)
 *
 * Used for A/B testing and content-targeted ads. Use utm_content to differentiate ads or links that point to the same URL.
 * Examples: utm_content=logolink or utm_content=textlink
 * Campaign Name (utm_campaign)
 *
 * Required. Used for keyword analysis. Use utm_campaign to identify a specific product promotion or strategic campaign.
 * Example: utm_campaign=spring_sale
 *
 * ---
 *
 * Modified from alexandru.topliceanu's example:
 * @link http://stackoverflow.com/a/9735852/1984644
 * @link http://nodejs.org/api/url.html#url_url_format_urlobj
 *
 */
exports.appendUTMParams = function (trackUrl, utmParams) {
  if (
    !trackUrl ||
    !utmParams ||
    !utmParams.source ||
    !utmParams.medium ||
    !utmParams.campaign
  ) {
    log('error', 'utmTrackify() missing one of the required variables.', {
      trackUrl,
      utmParamsSource: utmParams.source,
      utmParamsMedium: utmParams.medium,
      utmParamsCampaign: utmParams.campaign,
    });
    return trackUrl || '';
  }

  // Append required UTM parameters
  const obj = url.parse(trackUrl, true, false);
  obj.query.utm_source = String(utmParams.source);
  obj.query.utm_medium = String(utmParams.medium);
  obj.query.utm_campaign = String(utmParams.campaign);

  // Optional UTM parameters
  if (utmParams.term) {
    obj.query.utm_term = String(utmParams.term);
  }
  if (utmParams.content) {
    obj.query.utm_content = String(utmParams.content);
  }

  // This makes format compose the search string out of the query object
  delete obj.search;

  return url.format(obj);
};
