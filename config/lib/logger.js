'use strict';
// A general purpose logging service that can be used anywhere in the app

/**
 * Module dependencies.
 */
var path = require('path'),
    _ = require('lodash'),
    winston = require('winston'),
    // Requiring `winston-papertrail` will expose
    // `winston.transports.Papertrail`
    paperTrail = require('winston-papertrail').Papertrail,
    config = require(path.resolve('./config/config'));

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
