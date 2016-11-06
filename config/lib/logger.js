'use strict';
// A general purpose logging service that can be used anywhere in the app

/**
 * Module dependencies.
 */
var path = require('path'),
    _ = require('lodash'),
    winston = require('winston'),
    config = require(path.resolve('./config/config'));

// Requiring `winston-papertrail` will expose
// `winston.transports.Papertrail`
require('winston-papertrail').Papertrail;

var papertrailConfig = _.get(config, 'log.papertrail');

// If there we have a host and port for papertrail, then configure it
if (papertrailConfig.host && papertrailConfig.port) {
  // Add and instantiate the papertrail transport
  winston.add(winston.transports.Papertrail, papertrailConfig);
  // NOTE: We don't instantiate the papertrail transport, the call to `.add()`
  // does that on its own.
}

// Log that the logger has been instantiated
winston.log('info', 'Logger started #a5fKSK');

// We export winston directly
module.exports = winston;
