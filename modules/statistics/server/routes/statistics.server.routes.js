module.exports = function (app) {
  const statistics = require('../controllers/statistics.server.controller');

  // Setting up the statistics api
  app
    .route('/api/statistics')
    .post(statistics.collectStatistics)
    .get(statistics.getPublicStatistics);
};
