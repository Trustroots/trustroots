/**
 * Service for handing filters
 */
angular.module('core').factory('FiltersService', FiltersService);

/* @ngInject */
function FiltersService($log, Authentication, locker) {
  // Default structure for filters object
  const defaultFilters = {
    tribes: [],
    types: ['host', 'meet'],
    languages: [],
    seen: {
      months: 6,
    },
  };

  // Make cache id unique for this user
  const cachePrefix = Authentication.user
    ? 'search.filters.' + Authentication.user._id
    : 'search.filters';

  // Look up for filters from cache.
  // Returns `defaultFilters` if nothing is found.
  let filters = locker.supported()
    ? locker.get(cachePrefix, defaultFilters)
    : defaultFilters;

  // If cached filters were found, their structure might've been incomplete
  // `angular.extend` extends `filters` by copying own enumerable
  // properties from `defaultFilters` to `filters`.
  filters = angular.extend(defaultFilters, filters);

  const service = {
    set,
    get,
  };

  return service;

  /**
   * Get filter(s)
   *
   * @param filter String Filter name to receive. If undefined, will return all filters.
   */
  function get(filter) {
    // Single filter
    if (filter && angular.isString(filter)) {
      if (angular.isDefined(filters[filter])) {
        return filters[filter];
      } else {
        $log.warn('Requested filter does not exist.');
        return;
      }
    } else {
      // All filters
      return filters;
    }
  }

  /**
   * Set filter
   */
  function set(filter, content) {
    filters[filter] = content;

    // Cache whole filters object
    if (locker.supported()) {
      locker.put(cachePrefix, filters);
    }
  }
}
