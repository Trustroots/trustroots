angular.module('tribes').factory('TribeService', TribeService);

/* @ngInject */
function TribeService($resource, $q, $log) {
  // `$resource` to communicate with tribes REST API
  const Tribe = $resource(
    '/api/tribes/:tribeSlug',
    {
      tribeSlug: '@slug',
    },
    {
      get: {
        method: 'GET',
      },
    },
  );

  let cachedTribe;

  const service = {
    fillCache,
    clearCache,
    get,
  };

  return service;

  /**
   * Service to store single tribe object for caching
   * Automatically clears cache on `get()`.
   */
  function fillCache(tribe) {
    if (angular.isUndefined(tribe) || angular.isUndefined(tribe.slug)) {
      $log.error('Missing tribe to cache.');
      return;
    } else {
      cachedTribe = tribe;
      cachedTribe.$resolved = true;
    }
  }

  /**
   * Empty cache
   */
  function clearCache() {
    cachedTribe = undefined;
  }

  /**
   * Get tribe
   * First checks if tribe exists in cache and if not, returns API `$resource` promise
   * Automatically clears cache after retreiving object from cache
   */
  function get(options) {
    return $q(function (resolve, reject) {
      if (
        angular.isUndefined(options) ||
        angular.isUndefined(options.tribeSlug) ||
        !angular.isString(options.tribeSlug)
      ) {
        $log.error('Missing tribeSlug');
        reject();
      } else if (cachedTribe && cachedTribe.slug === options.tribeSlug) {
        // Found from cache
        resolve(cachedTribe);
        clearCache();
      } else {
        // Not found from cache, return $resource
        Tribe.get({
          tribeSlug: options.tribeSlug,
        })
          .$promise.then(function (tribe) {
            resolve(tribe);
          })
          .catch(function () {
            reject();
          });
      }
    });
  }
}
