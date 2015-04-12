'use strict';

/**
 * Module dependencies.
 */
var _ = require('lodash'),
  glob = require('glob');

/**
 * Load app configurations
 */
module.exports = _.extend(
  require('./env/all'),
  require('./env/' + process.env.NODE_ENV) || {}
);

/**
 * Load secret config (if it exists)
 */
try {
  var secret = require('./secret/' + process.env.NODE_ENV);
  var config = _.extend(
    module.exports,
    secret
  );
  module.exports = config;
}
catch (error) {}

/**
 * Get files by glob patterns
 */
module.exports.getGlobbedFiles = function(globPatterns, removeRoot) {
  // For context switching
  var _this = this;

  // URL paths regex
  var urlRegex = new RegExp('^(?:[a-z]+:)?\/\/', 'i');

  // The output array
  var output = [];

  // If glob pattern is array so we use each pattern in a recursive way, otherwise we use glob
  if (_.isArray(globPatterns)) {
    globPatterns.forEach(function(globPattern) {
      output = _.union(output, _this.getGlobbedFiles(globPattern, removeRoot));
    });
  } else if (_.isString(globPatterns)) {
    if (urlRegex.test(globPatterns)) {
      output.push(globPatterns);
    } else {
      glob(globPatterns, {
        sync: true
      }, function(err, files) {
        if (removeRoot) {
          files = files.map(function(file) {
            return file.replace(removeRoot, '');
          });
        }

        output = _.union(output, files);
      });
    }
  }

  return output;
};

/**
 * Get the modules JavaScript files
 */
module.exports.getJavaScriptAssets = function(includeTests) {

  var output;

  // Production
  if(process.env.NODE_ENV === 'production') {
    output = ['/dist/application.min.js'];
  }

  // Development
  else {
    output = this.getGlobbedFiles(this.assets.lib.js.concat(this.assets.js), 'public/');

    // To include tests
    if (includeTests) {
      output = _.union(output, this.getGlobbedFiles(this.assets.tests));
    }

  }

  // Add socket.io
  //output = ['/socket.io/socket.io.js'].concat(output);

  return output;
};

/**
 * Get the modules CSS files
 * Combine them with newly produced CSS file from LESS
 */
module.exports.getCSSAssets = function() {
  return ['/dist/application.min.css'];
};
