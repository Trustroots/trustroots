/*
 * A general purpose logging service that can be used anywhere in the app
 *
 * See docs/Logging.md
 */

/**
 * Module dependencies.
 */
const path = require('path');
const _ = require('lodash');
const winston = require('winston');
const config = require(path.resolve('./config/config'));

// Requiring `winston-papertrail` will expose
// `winston.transports.Papertrail`
require('winston-papertrail').Papertrail;

const papertrailConfig = _.get(config, 'log.papertrail');

// Add the `logFormat()` function to the papertrail config
papertrailConfig.logFormat = function (level, message) {
  return level + ': ' + message;
};

// If there we have a host and port for papertrail, then configure it
if (papertrailConfig.host && papertrailConfig.port) {
  // Add and instantiate the papertrail transport
  winston.add(winston.transports.Papertrail, papertrailConfig);
  // NOTE: We don't instantiate the papertrail transport, the call to `.add()`
  // does that on its own.
}

// Log that the logger has been instantiated
winston.log('info', 'Logger started #a5fKSK');
// Add a console.log() to help debugging logger issues
console.log('Logger just started #SQrUgw');

// We export `winston.log` so we can use `logger('info', ...)` etc
module.exports = winston.log;
