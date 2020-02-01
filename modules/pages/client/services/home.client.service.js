// Service used for communicating with the server REST endpoints

angular
  .module('pages')
  .factory('Home', UserCountService);

/* @ngInject */
function UserCountService($resource) {
  return $resource('/api/statistics/total');
}
