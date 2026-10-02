/*
 * A general purpose logging service that can be used anywhere in the app
 *
 * See docs/Logging.md
 */

/**
 * Module dependencies.
 */
const _ = require('lodash');
const winston = require('winston');
const config = require('../config');
const { redactMetadata } = require('./log-redaction');

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

// Keep Winston's existing arguments and return value, while sanitising any
// object arguments before they reach a configured transport.
module.exports = function log() {
  const args = Array.prototype.slice.call(arguments);
  for (let index = 1; index < args.length; index += 1) {
    if (args[index] && typeof args[index] === 'object') {
      args[index] = redactMetadata(args[index]);
    }
  }
  return winston.log.apply(winston, args);
};
