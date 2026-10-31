import type { ReactRoutePolicy } from '../../core/shared/react-route-ownership.mts';

export const MESSAGES_ROUTE_POLICIES: ReactRoutePolicy[] = [
  { path: '/messages', title: 'Messages', requiresAuth: true },
  {
    path: '/messages/:username',
    title: 'Messages',
    requiresAuth: true,
    footerHidden: true,
  },
];
