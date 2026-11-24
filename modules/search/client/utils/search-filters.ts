type SearchType = string | { id: string };

export interface SearchFilters {
  tribes: string[];
  types: SearchType[];
  languages: string[];
  seen: { months: number };
  communityNotes: boolean;
  connectionsOnly?: boolean;
  volunteering?: boolean;
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
  volunteering: false,
};

function normalizeTypes(types: SearchType[] = []): string[] {
  const values = (types || []).map(type =>
    typeof type === 'object' ? type.id : type,
  );
  const selected = ['host', 'meet'].filter(type => values.includes(type));
  return selected.length ? selected : ['meet'];
}

/**
 * How many filters narrow the search beyond the defaults: circles, languages,
 * connections, volunteering, and limiting the offer types. Used for analytics, which may count filters but not
 * know which circles or languages.
 */
export function countNarrowingFilters(filters: Partial<SearchFilters>): number {
  return [
    Boolean(filters.tribes?.length),
    Boolean(filters.languages?.length),
    filters.connectionsOnly === true,
    filters.volunteering === true,
    Boolean(filters.types) && normalizeTypes(filters.types).length === 1,
  ].filter(Boolean).length;
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

export function readSearchFiltersParam(value?: string): SearchFilters | null {
  if (!value) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  const filters = parsed as Partial<SearchFilters>;
  const types = Array.isArray(filters.types)
    ? normalizeTypes(filters.types.filter(type => typeof type === 'string'))
    : DEFAULT_FILTERS.types;
  return {
    types,
    tribes: Array.isArray(filters.tribes)
      ? filters.tribes.filter(
          id => typeof id === 'string' && /^[a-f0-9]{24}$/i.test(id),
        )
      : [],
    languages: Array.isArray(filters.languages)
      ? filters.languages.filter(language => typeof language === 'string')
      : [],
    seen: filters.seen?.months === 24 ? { months: 24 } : DEFAULT_FILTERS.seen,
    communityNotes:
      typeof filters.communityNotes === 'boolean'
        ? filters.communityNotes
        : DEFAULT_FILTERS.communityNotes,
    connectionsOnly: filters.connectionsOnly === true,
    volunteering: types.includes('host') && filters.volunteering === true,
  };
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
