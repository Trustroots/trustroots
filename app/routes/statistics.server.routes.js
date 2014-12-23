'use strict';

module.exports = function(app) {

  var statistics = require('../../app/controllers/statistics');

  // Setting up the statistics api
  app.route('/statistics').get(statistics.get);

};
