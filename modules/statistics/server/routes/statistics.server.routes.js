'use strict';

module.exports = function(app) {

  //var statisticsPolicy = require('../policies/statistics.server.policy');
  var statistics = require('../controllers/statistics.server.controller');

  // Setting up the statistics api
  app.route('/api/statistics').get(statistics.get);

};
