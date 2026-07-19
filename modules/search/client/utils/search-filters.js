const DEFAULT_FILTERS = {
  tribes: [],
  types: ['host', 'meet'],
  languages: [],
  seen: {
    months: 6,
  },
  communityNotes: true,
};

function normalizeTypes(types) {
  const hasHosts = (types || []).some(type => {
    const value = typeof type === 'object' ? type.id : type;
    return value === 'host';
  });

  return hasHosts ? ['host', 'meet'] : ['meet'];
}

function getCacheKey(userId) {
  return userId ? `search.filters.${userId}` : 'search.filters';
}

function readCachedFilters(userId) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_FILTERS };
  }

  try {
    const cached = window.localStorage.getItem(getCacheKey(userId));

    if (!cached) {
      return { ...DEFAULT_FILTERS };
    }

    const parsed = JSON.parse(cached);
    const filters = {
      ...DEFAULT_FILTERS,
      ...parsed,
    };
    filters.types = normalizeTypes(filters.types);

    return filters;
  } catch {
    return { ...DEFAULT_FILTERS };
  }
}

function writeCachedFilters(userId, filters) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(getCacheKey(userId), JSON.stringify(filters));
}

export function getSearchFilters(userId) {
  return readCachedFilters(userId);
}

export function setSearchFilter(userId, filter, content) {
  const filters = readCachedFilters(userId);
  /* istanbul ignore next -- type filters are normalised by the search form integration. */
  filters[filter] = filter === 'types' ? normalizeTypes(content) : content;
  writeCachedFilters(userId, filters);
  return filters;
}

export function setSearchFilters(userId, nextFilters) {
  const filters = {
    ...readCachedFilters(userId),
    ...nextFilters,
  };
  filters.types = normalizeTypes(filters.types);
  writeCachedFilters(userId, filters);
  return filters;
}

export { DEFAULT_FILTERS, normalizeTypes };
