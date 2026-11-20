import { queryOptions, type QueryClient } from '@tanstack/react-query';

import * as api from './tribes.api';
import type { TribeSummary } from './tribes.api';

// Fresh long enough for the page to reuse what its route loader fetched.
const staleTime = 60_000;

// Guests and members can see different circle data, so each viewer has its own cache.
export function circlesQuery(viewerId?: string) {
  return queryOptions({
    queryKey: ['circles', viewerId],
    queryFn: () => api.read(),
    staleTime,
  });
}

export function circleQuery(slug: string, viewerId?: string) {
  return queryOptions({
    queryKey: ['circle', slug, viewerId],
    queryFn: () => api.get(slug),
    staleTime,
    // A missing circle shows its not-found message straight away.
    retry: false,
  });
}

/** Apply updated circle fields to every cached list and detail. */
export function setCachedCircle(
  queryClient: QueryClient,
  circle: Pick<TribeSummary, '_id'> & Partial<TribeSummary>,
) {
  const update = (cached: TribeSummary) =>
    cached._id === circle._id ? { ...cached, ...circle } : cached;
  queryClient.setQueriesData<TribeSummary[]>({ queryKey: ['circles'] }, list =>
    list?.map(update),
  );
  queryClient.setQueriesData<TribeSummary>(
    { queryKey: ['circle'] },
    cached => cached && update(cached),
  );
}
