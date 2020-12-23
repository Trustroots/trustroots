/**
 * This module is used to receive incoming SparkPost events
 *
 * Note that `bodyParser.json()` has a default limit of 100kb.
 * If you need to process larger requets, you need to change that.
 * @link https://github.com/expressjs/body-parser#bodyparserjsonoptions
 */

/**
 * Module dependencies.
 */
const _ = require('lodash');
const path = require('path');
const async = require('async');
const basicAuth = require('basic-auth');
const speakingurl = require('speakingurl');
const log = require(path.resolve('./config/lib/logger'));
const errorService = require(path.resolve(
  './modules/core/server/services/error.server.service',
));
const statService = require(path.resolve(
  './modules/stats/server/services/stats.server.service',
));
const config = require(path.resolve('./config/config'));

/**
 * Receive Sparkpost events webhook batch
 *
 * From SparkPost's view:
 * - Any webhook batch that does not receive an HTTP 200 response will
 *   be retried for a total of 4 hours before the data is discarded.
 * - Webhooks posting to this endpoint will timeout after 10 seconds.
 * - Each webhook batch contains the header X-MessageSystems-Batch-ID, which
 *   is useful for auditing and prevention of processing duplicate batches.
 *
 * @link https://www.sparkpost.com/blog/webhooks-beyond-the-basics/
 * @link https://developers.sparkpost.com/api/webhooks.html
 * @link https://support.sparkpostelite.com/customer/en/portal/articles/2232381-sparkpost-event-and-metrics-definitions
 *
 * @todo Prevent processing duplicate batches.
 */
exports.receiveBatch = function (req, res) {
  if (!_.isArray(req.body) || !req.body.length) {
    return res.status(400).send({
      message: errorService.getErrorMessageByKey('bad-request'),
    });
  }

  // eslint-disable-next-line no-unused-vars
  async.map(req.body, exports.processAndSendMetrics, function (err) {
    // @TODO what should happen when writing to stats api errors?
    res.status(200).end();
  });
};

/**
 * Process event and send it to InfluxDB
 */
exports.processAndSendMetrics = function (event, callback) {
  // When adding a webhook, Sparkpost sends us `[{"msys":{}}]`
  if (!_.has(event, 'msys') || _.isEmpty(event.msys)) {
    return callback();
  }

  // we changed fields to meta
  // only numbers can be saved as count/value in stathat, so every string value must be either tag (saved) or meta (ignored)
  const meta = {
    country: '',
    campaignId: '',
  };

  const tags = {};

  // Validate against these event categories
  // E.g. `{ msys: message_event: { } }`
  const eventCategories = [
    'message_event',
    'relay_event',
    'track_event',
    'gen_event',
    'unsubscribe_event',
  ];

  // Validate against these event types
  // E.g. `{ msys: message_event: { type: 'bounce' } }`
  const eventTypes = [
    'injection',
    'delivery',
    'policy_Rejection',
    'delay',
    'bounce',
    'out_of_band',
    'spam_complaint',
    'generation_failure',
    'generation_rejection',
    'policy_rejection',
    'sms_status',
    'link_unsubscribe',
    'list_unsubscribe',
    'relay_delivery',
    'relay_injection',
    'relay_rejection',
    'relay_tempfail',
    'relay_permfail',
    'open',
    'click',
  ];

  // Get what's in first key of `msys` object
  const eventCategory = _.keys(event.msys)[0];

  // Get what's the `type` of that event
  const eventType = _.get(event, 'msys.' + eventCategory + '.type');

  // Validate event category
  tags.category = _.find(eventCategories, function (category) {
    // Returns first match from array
    return category === eventCategory;
  });

  // Validate event type
  tags.type = _.find(eventTypes, function (type) {
    // Returns first match from array
    return type === eventType;
  });

  // Didn't validate, don't continue
  if (!tags.category || !tags.type) {
    log('error', 'Could not validate SparkPost event webhook.', {
      type: eventType,
      category: eventCategory,
    });
    return callback();
  }

  // Add campaign id to meta if present
  const campaignId = _.get(event, 'msys.' + eventCategory + '.campaign_id');
  if (_.isString(campaignId) && campaignId.length > 0) {
    // "Slugify" `campaignId` to ensure we don't get any carbage
    // Allows only `A-Za-z0-9_-`
    meta.campaignId = speakingurl(campaignId, {
      separator: '-', // char that replaces the whitespaces
      maintainCase: false, // don't maintain case
      truncate: 255, // truncate to 255 chars
    });
  }

  // Add country if present
  const country = _.get(event, 'msys.' + eventCategory + '.geo_ip.country');
  if (_.isString(country) && country.length > 0 && country.length <= 3) {
    meta.country = country.replace(/\W/g, '').toUpperCase();
  }

  const statObj = {
    namespace: 'transactionalEmailEvent',
    counts: {
      count: 1,
    },
    tags,
    meta,
  };

  // Set `time` field to event's timestamp
  const timestamp = _.get(event, 'msys.' + eventCategory + '.timestamp');
  if (timestamp) {
    statObj.time = new Date(parseInt(timestamp, 10) * 1000);
  }

  // send the stats via generalized stat api
  statService.stat(statObj, callback);
};

/**
 * Basic authentication middleware
 */
exports.basicAuthenticate = function (req, res, next) {
  // Get the basic auth credentials from the request.
  // The Authorization header is parsed and if the header is invalid,
  // undefined is returned, otherwise an object with name and pass properties.
  const credentials = basicAuth(req);

  const enabled = _.get(config, 'sparkpostWebhook.enabled');

  // Access denied
  if (
    !credentials ||
    enabled !== true ||
    credentials.name !== config.sparkpostWebhook.username ||
    credentials.pass !== config.sparkpostWebhook.password
  ) {
    res.set('WWW-Authenticate', 'Basic realm="Knock Knock"');
    return res.status(401).send({
      message: 'Access denied',
    });
  }

  // Access granted
  return next();
};
