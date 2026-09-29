import statistics from '../controllers/statistics.server.controller.js';

export default function (app) {
  // Setting up the statistics api
  app
    .route('/api/statistics')
    .post(statistics.collectStatistics)
    .get(statistics.getPublicStatistics);
}
