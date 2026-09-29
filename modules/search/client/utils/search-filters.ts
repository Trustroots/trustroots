type SearchType = string | { id: string };

export interface SearchFilters {
  tribes: string[];
  types: SearchType[];
  languages: string[];
  seen: { months: number };
  communityNotes: boolean;
  [key: string]: unknown;
}

const DEFAULT_FILTERS: SearchFilters = {
  tribes: [],
  types: ['host', 'meet'],
  languages: [],
  seen: {
    months: 6,
  },
  communityNotes: true,
};

function normalizeTypes(types: SearchType[] = []): string[] {
  const hasHosts = (types || []).some(type => {
    const value = typeof type === 'object' ? type.id : type;
    return value === 'host';
  });

  return hasHosts ? ['host', 'meet'] : ['meet'];
}

function getCacheKey(userId?: string | null): string {
  return userId ? `search.filters.${userId}` : 'search.filters';
}

function readCachedFilters(userId?: string | null): SearchFilters {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { ...DEFAULT_FILTERS };
  }

  try {
    const cached = window.localStorage.getItem(getCacheKey(userId));

    if (!cached) {
      return { ...DEFAULT_FILTERS };
    }

    const parsed = JSON.parse(cached) as Partial<SearchFilters>;
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

function writeCachedFilters(
  userId: string | null | undefined,
  filters: SearchFilters,
): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(getCacheKey(userId), JSON.stringify(filters));
}

export function getSearchFilters(userId?: string | null): SearchFilters {
  return readCachedFilters(userId);
}

export function setSearchFilter(
  userId: string | null | undefined,
  filter: string,
  content: unknown,
): SearchFilters {
  const filters = readCachedFilters(userId);
  /* istanbul ignore next -- type filters are normalised by the search form integration. */
  filters[filter] =
    filter === 'types' ? normalizeTypes(content as SearchType[]) : content;
  writeCachedFilters(userId, filters);
  return filters;
}

export function setSearchFilters(
  userId: string | null | undefined,
  nextFilters: Partial<SearchFilters>,
): SearchFilters {
  const filters = {
    ...readCachedFilters(userId),
    ...nextFilters,
  };
  filters.types = normalizeTypes(filters.types);
  writeCachedFilters(userId, filters);
  return filters;
}

export { DEFAULT_FILTERS, normalizeTypes };
