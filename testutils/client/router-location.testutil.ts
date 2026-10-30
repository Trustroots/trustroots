/**
 * Component tests render pages without a router. Use this module as the
 * `@tanstack/react-router` mock so route hooks read the jsdom URL instead:
 *
 *   jest.mock('@tanstack/react-router', () =>
 *     jest.requireActual('@/testutils/client/router-location.testutil'),
 *   );
 *
 * Like the router, the hooks re-render on browser history (popstate) changes,
 * and `useNavigate`/`<Navigate>` write the jsdom URL.
 */
const { useEffect, useSyncExternalStore } =
  jest.requireActual<typeof import('react')>('react');

type Select<T> = { select?: (value: T) => unknown };
type Search = Record<string, unknown>;
type NavigateOptions = {
  hash?: true | string;
  params?: Record<string, string | undefined>;
  replace?: boolean;
  search?: true | Search | ((search: Record<string, string>) => Search);
  to?: string;
};

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

// Mirrors the router: omitted search and hash are dropped, `$param` segments
// come from `params`, and navigating to the current URL writes nothing.
function navigate({
  hash,
  params = {},
  replace,
  search,
  to = '.',
}: NavigateOptions) {
  const current = new URL(window.location.href);
  const currentSearch = Object.fromEntries(current.searchParams);
  const nextSearch =
    search === true
      ? currentSearch
      : typeof search === 'function'
        ? search(currentSearch)
        : search || {};
  const next = new URL(
    to === '.'
      ? current.pathname
      : to.replace(/\$(\w+)/g, (_, name) =>
          encodeURIComponent(params[name] || ''),
        ),
    current,
  );
  Object.entries(nextSearch).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      next.searchParams.set(key, String(value));
    }
  });
  next.hash = hash === true ? current.hash : hash || '';

  if (next.href !== current.href) {
    window.history[replace ? 'replaceState' : 'pushState']({}, '', next);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
  return Promise.resolve();
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
  Navigate: (options: NavigateOptions) => {
    useEffect(() => {
      void navigate(options);
    }, []);
    return null;
  },
  useNavigate: () => navigate,
  useParams: (options?: Select<Record<string, string>>) => {
    const { matchReactRoute } = jest.requireActual(
      '@/modules/core/shared/react-route-ownership.mts',
    );
    return read(matchReactRoute(useUrl().pathname)?.params || {}, options);
  },
  useSearch: (options?: Select<Record<string, string>>) =>
    read(Object.fromEntries(useUrl().searchParams), options),
};
