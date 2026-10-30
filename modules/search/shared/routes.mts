import type { ReactRoutePolicy } from '../../core/shared/react-route-ownership.mts';

export const SEARCH_ROUTE_POLICIES: ReactRoutePolicy[] = [
  { path: '/search', title: 'Search', requiresAuth: true, footerHidden: true },
  {
    path: '/search/members',
    title: 'Search members',
    requiresAuth: true,
    footerHidden: true,
  },
];
