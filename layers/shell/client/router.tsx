import { createRouter } from '@tanstack/react-router';

import { routeTree } from './routeTree';

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
    context: { user: null },
    defaultPreload: 'intent',
    parseSearch: parseLegacySearch,
    routeTree,
    scrollRestoration: () => false,
    stringifySearch: stringifyLegacySearch,
  });
}
