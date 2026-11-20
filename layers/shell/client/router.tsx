import { QueryClient } from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';

import { getBootstrapData } from './bootstrap';
import { matchAppRoute } from './route-options';
import { routeTree } from './routeTree.gen';

export function parseLegacySearch(search: string): Record<string, string> {
  const values: Record<string, string> = {};
  new URLSearchParams(search).forEach((value, key) => {
    values[key] = value;
  });
  return values;
}

export function stringifyLegacySearch(
  search: Record<string, string | number | boolean | null | undefined>,
): string {
  const searchParams = new URLSearchParams();

  Object.entries(search).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

export function createAppRouter() {
  let shownRouteId: string | null | undefined = null;
  const router = createRouter({
    context: { queryClient: new QueryClient(), user: getBootstrapData().user },
    defaultPreload: 'intent',
    parseSearch: parseLegacySearch,
    routeTree,
    // Scroll to the top when the page changes, unless it opts out. Query
    // and param changes on the same page keep their place.
    scrollRestoration: ({ location }) => {
      const match = matchAppRoute(router, location.pathname);
      const pageChanged = match?.routeId !== shownRouteId;
      shownRouteId = match?.routeId;
      return (
        Boolean(location.hash) ||
        (pageChanged && !match?.staticData.noScrollingTop)
      );
    },
    stringifySearch: stringifyLegacySearch,
  });
  return router;
}
