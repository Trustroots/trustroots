import statistics from './../controllers/statistics.server.controller.mjs';
const defaultInterop = function (app) {
  // Setting up the statistics api
  app
    .route('/api/statistics')
    .post(statistics.collectStatistics)
    .get(statistics.getPublicStatistics);
};
export default defaultInterop;
export { defaultInterop as 'module.exports' };
