/**
 * Component tests render pages without a router. Use this module as the
 * `@tanstack/react-router` mock so route hooks read the jsdom URL instead:
 *
 *   jest.mock('@tanstack/react-router', () =>
 *     jest.requireActual('@/testutils/client/router-location.testutil'),
 *   );
 *
 * Like the router, the hooks re-render on browser history (popstate) changes.
 */
const { useSyncExternalStore } =
  jest.requireActual<typeof import('react')>('react');

type Select<T> = { select?: (value: T) => unknown };

function subscribe(onChange: () => void) {
  window.addEventListener('popstate', onChange);
  return () => window.removeEventListener('popstate', onChange);
}

function useUrl() {
  return new URL(useSyncExternalStore(subscribe, () => window.location.href));
}

function read<T>(value: T, { select }: Select<T> = {}) {
  return select ? select(value) : value;
}

module.exports = {
  ...jest.requireActual('@tanstack/react-router'),
  useLocation: (options?: Select<Record<string, string>>) => {
    const url = useUrl();
    return read(
      {
        hash: url.hash.slice(1),
        href: `${url.pathname}${url.search}${url.hash}`,
        pathname: url.pathname,
        searchStr: url.search,
      },
      options,
    );
  },
  useParams: (options?: Select<Record<string, string>>) => {
    const { matchReactRoute } = jest.requireActual(
      '@/modules/core/shared/react-route-ownership.mts',
    );
    return read(matchReactRoute(useUrl().pathname)?.params || {}, options);
  },
  useSearch: (options?: Select<Record<string, string>>) =>
    read(Object.fromEntries(useUrl().searchParams), options),
};
