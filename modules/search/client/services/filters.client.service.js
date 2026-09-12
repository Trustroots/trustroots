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
    communityNotes: true,
  };

  // Make cache id unique for this user
  const cachePrefix = Authentication.user
    ? 'search.filters.' + Authentication.user._id
    : 'search.filters';

  // Look up for filters from cache.
  // Returns `defaultFilters` if nothing is found.
  const storageSupported = locker.supported();
  let filters = storageSupported
    ? locker.get(cachePrefix, defaultFilters)
    : defaultFilters;

  // If cached filters were found, their structure might've been incomplete
  // `angular.extend` extends `filters` by copying own enumerable
  // properties from `defaultFilters` to `filters`.
  filters = angular.extend(defaultFilters, filters);
  const normalizedTypes = normalizeTypes(filters.types);
  const typesChanged = !angular.equals(filters.types, normalizedTypes);
  filters.types = normalizedTypes;

  // Upgrade cached host-only or empty filters even when the sidebar directive
  // is not mounted (for example for visitors).
  if (storageSupported && typesChanged) {
    locker.put(cachePrefix, filters);
  }

  const service = {
    set,
    get,
  };

  return service;

  function normalizeTypes(types) {
    const hasHosts = (types || []).some(function (type) {
      return (angular.isObject(type) ? type.id : type) === 'host';
    });

    return hasHosts ? ['host', 'meet'] : ['meet'];
  }

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
    filters[filter] = filter === 'types' ? normalizeTypes(content) : content;

    // Cache whole filters object
    if (locker.supported()) {
      locker.put(cachePrefix, filters);
    }
  }
}
