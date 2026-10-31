import type { ReactRoutePolicy } from '../../core/shared/react-route-ownership.mts';

export const EXPERIENCES_ROUTE_POLICIES: ReactRoutePolicy[] = [
  {
    path: '/experiences/:id/change',
    title: 'Change an Experience',
    requiresAuth: true,
  },
];
