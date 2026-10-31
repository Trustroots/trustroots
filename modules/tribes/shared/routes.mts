import type { ReactRoutePolicy } from '../../core/shared/react-route-ownership.mts';

export const TRIBES_ROUTE_POLICIES: ReactRoutePolicy[] = [
  { path: '/circles', title: 'Circles' },
  {
    path: '/circles/:circle',
    title: 'Circle',
    footerVariant: 'circle',
    requiresAuthParams: {
      circle: ['naturists'],
    },
  },
];
