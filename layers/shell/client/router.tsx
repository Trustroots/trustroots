import { createRouter } from '@tanstack/react-router';

import { matchReactRoute } from '@/modules/core/shared/react-route-ownership.mts';
import { routes, routeTree } from './routeTree';

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
  return createRouter({
    context: {
      navigateOverride: undefined,
    },
    defaultPreload: 'intent',
    parseSearch: parseLegacySearch,
    routeTree,
    scrollRestoration: () => false,
    stringifySearch: stringifyLegacySearch,
  });
}

export function findRoute(path: string) {
  const matched = matchReactRoute(path);

  if (!matched?.policy) {
    return undefined;
  }

  return {
    ...matched.policy,
    params: matched.params,
    render: routes.find(route => route.path === matched.policy.path)!.render,
  };
}
