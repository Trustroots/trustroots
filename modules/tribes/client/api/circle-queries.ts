import { queryOptions } from '@tanstack/react-query';

import * as api from './tribes.api';

// Fresh long enough for the page to reuse what its route loader fetched.
const staleTime = 60_000;

export const circlesQuery = queryOptions({
  queryKey: ['circles'],
  queryFn: () => api.read(),
  staleTime,
});

export function circleQuery(slug: string) {
  return queryOptions({
    queryKey: ['circle', slug],
    queryFn: () => api.get(slug),
    staleTime,
    // A missing circle shows its not-found message straight away.
    retry: false,
  });
}
