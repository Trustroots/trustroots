import { createRouter } from '@tanstack/react-router';

import {
  getReactRoutePolicy,
  type ReactRoutePolicy,
} from '@/modules/core/shared/react-route-ownership.mts';
import { getBootstrapData } from './bootstrap';
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
  let shownPolicy: ReactRoutePolicy | null | undefined;
  return createRouter({
    context: { user: getBootstrapData().user },
    defaultPreload: 'intent',
    parseSearch: parseLegacySearch,
    routeTree,
    // Scroll to the top when the page changes, unless it opts out. Query
    // and param changes on the same page keep their place.
    scrollRestoration: ({ location }) => {
      const policy = getReactRoutePolicy(location.pathname);
      const pageChanged = policy !== shownPolicy;
      shownPolicy = policy;
      return Boolean(location.hash) || (pageChanged && !policy?.noScrollingTop);
    },
    stringifySearch: stringifyLegacySearch,
  });
}
