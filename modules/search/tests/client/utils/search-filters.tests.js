import {
  DEFAULT_FILTERS,
  getSearchFilters,
  normalizeTypes,
  setSearchFilter,
  setSearchFilters,
} from '@/modules/search/client/utils/search-filters';

describe('search-filters utils', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('returns default filters when nothing is cached', () => {
    expect(getSearchFilters('user-1')).toEqual(DEFAULT_FILTERS);
  });

  it('normalises host-only cached types to include meetups', () => {
    window.localStorage.setItem(
      'search.filters.user-1',
      JSON.stringify({
        types: ['host'],
      }),
    );

    expect(getSearchFilters('user-1').types).toEqual(['host', 'meet']);
  });

  it('persists single filter updates', () => {
    setSearchFilter('user-1', 'languages', ['en', 'fi']);

    expect(getSearchFilters('user-1').languages).toEqual(['en', 'fi']);
  });

  it('merges partial filter updates', () => {
    setSearchFilters('user-1', {
      tribes: ['cyclists'],
      types: ['meet'],
    });

    expect(getSearchFilters('user-1')).toMatchObject({
      tribes: ['cyclists'],
      types: ['meet'],
    });
  });

  it('keeps meet-only filters when hosts are disabled', () => {
    expect(normalizeTypes(['meet'])).toEqual(['meet']);
  });

  it('normalises host object filters to include meetups', () => {
    expect(normalizeTypes([{ id: 'host' }])).toEqual(['host', 'meet']);
  });

  it('returns default filters when cached JSON is invalid', () => {
    window.localStorage.setItem('search.filters.user-1', '{not-json');

    expect(getSearchFilters('user-1')).toEqual(DEFAULT_FILTERS);
  });

  it('uses the anonymous cache key when no user id is provided', () => {
    setSearchFilter(null, 'languages', ['en']);

    expect(window.localStorage.getItem('search.filters')).toContain('"en"');
  });

  it('normalises empty and meet-only type values', () => {
    expect(normalizeTypes()).toEqual(['meet']);
    expect(normalizeTypes([{ id: 'meet' }])).toEqual(['meet']);
  });

  it('uses defaults when local storage is unavailable', () => {
    const originalStorage = window.localStorage;
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: null,
    });

    try {
      expect(getSearchFilters('user-1')).toEqual(DEFAULT_FILTERS);
      expect(setSearchFilter('user-1', 'languages', ['fi'])).toEqual(
        expect.objectContaining({ languages: ['fi'] }),
      );
    } finally {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: originalStorage,
      });
    }
  });
});
