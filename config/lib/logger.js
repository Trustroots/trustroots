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
  // Instantiate the papertrail transport
  var winstonPapertrail = new winston.transports.Papertrail(papertrailConfig);

  // Add the papertrail transport to winston
  winston.add(winstonPapertrail);
}

// We export winston directly
module.exports = winston;
