angular.module('tribes').factory('TribesService', TribesService);

/* @ngInject */
function TribesService($resource) {
  return $resource(
    '/api/tribes',
    {
      limit: 150,
    },
    {
      query: {
        method: 'GET',
        isArray: true,
      },
    },
  );
}
