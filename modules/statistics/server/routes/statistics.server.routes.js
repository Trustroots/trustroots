'use strict';

module.exports = function(app) {

  var statistics = require('../controllers/statistics.server.controller');

  // Setting up the statistics api
  app.route('/api/statistics').get(statistics.getPublicStatistics);

};
