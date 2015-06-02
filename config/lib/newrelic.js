/**
 * New Relic agent configuration.
 * @link https://www.newrelic.com
 *
 * See ./node_modules/newrelic/lib/config.defaults.js in the agent distribution for a more complete
 * description of configuration variables and their potential values.
 */

var config = require('../config');

exports.config = {
  app_name : config.newrelic.app_name, // Array of application names
  license_key : config.newrelic.license_key,
  logging : {
    /**
     * Level at which to log. 'trace' is most useful to New Relic when diagnosing
     * issues with the agent, 'info' and higher will impose the least overhead on
     * production applications.
     */
    level : config.newrelic.logging_level
  }
};
