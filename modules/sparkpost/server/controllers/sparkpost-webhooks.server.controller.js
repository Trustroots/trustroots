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
 * @link https://developers.sparkpost.com/api/webhooks/
 *
 * @todo Prevent processing duplicate batches.
 */
exports.receiveBatch = (req, res) => {
  if (_.isarray(req.body) || !req.body.length) {
    return res.status(400).send({
      message: errorService.getErrorMessageByKey('bad-request'),
    });
  }

  async.map(req.body, exports.processAndSendMetrics, () => {
    res.status(200).end();
  });
};

/**
 * Process event and send it to InfluxDB
 */
exports.processAndSendMetrics = (event, callback) => {
  // When adding a webhook, Sparkpost sends us `[{"msys":{}}]`
  if (!event?.msys) {
    return callback();
  }

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
    'ab_test_cancelled',
    'ab_test_completed',
    'amp_click',
    'amp_initial_open',
    'amp_open',
    'bounce',
    'click',
    'delay',
    'delivery',
    'error',
    'generation_failure',
    'generation_rejection',
    'initial_open',
    'injection',
    'link_unsubscribe',
    'list_unsubscribe',
    'open',
    'out_of_band',
    'policy_rejection',
    'relay_delivery',
    'relay_injection',
    'relay_permfail',
    'relay_rejection',
    'relay_tempfail',
    'spam_complaint',
    'success',
  ];

  // Get what's in first key of `msys` object
  const eventCategory = Object.keys(event?.msys ?? {})[0];

  const eventData = event?.msys[eventCategory];

  // Get what's the `type` of that event
  const eventType = eventData?.type ?? 'unknown';

  // Didn't validate, don't continue
  if (
    !eventCategories.includes(eventCategory) ||
    !eventTypes.includes(eventType)
  ) {
    log('error', 'Could not validate SparkPost event webhook.', {
      type: eventType,
      category: eventCategory,
    });
    return callback();
  }

  const mailboxProvider = eventData?.mailbox_provider ?? 'unknown';

  // Add campaign id to tags if present
  let campaignId = String(eventData?.campaign_id ?? '');
  if (campaignId.length > 0) {
    // "Slugify" `campaignId` to ensure we don't get any carbage
    // Allows only `A-Za-z0-9_-`
    campaignId = speakingurl(campaignId, {
      separator: '-', // char that replaces the whitespaces
      maintainCase: false, // don't maintain case
      truncate: 255, // truncate to 255 chars
    });
  }

  // Add country if present
  let country = String(eventData?.geo_ip?.country ?? '');
  if (country.length > 0 && country.length <= 3) {
    country = country.replace(/\W/g, '').toUpperCase();
  }

  const statObj = {
    namespace: 'transactionalEmailEvent',
    counts: {
      count: 1,
    },
    tags: {
      campaignId,
      country,
      eventCategory,
      eventType,
      mailboxProvider,
    },
    meta: {},
  };

  // Set `time` field to event's timestamp
  if (eventData?.timestamp) {
    statObj.time = new Date(parseInt(eventData?.timestamp, 10) * 1000);
  }

  // Send the stats via generalized stat api
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

  const enabled = config?.sparkpostWebhook?.enabled;

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
