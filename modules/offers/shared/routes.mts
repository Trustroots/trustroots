import type { ReactRoutePolicy } from '../../core/shared/react-route-ownership.mts';

export const OFFERS_ROUTE_POLICIES: ReactRoutePolicy[] = [
  { path: '/offer', title: 'Host travellers', requiresAuth: true },
  {
    path: '/offer/host',
    title: 'Host travellers',
    requiresAuth: true,
    footerHidden: true,
  },
  { path: '/offer/meet', title: 'Meet', requiresAuth: true },
  {
    path: '/offer/meet/add',
    title: 'Add meeting offer',
    requiresAuth: true,
    footerHidden: true,
  },
  {
    path: '/offer/meet/:offerId',
    title: 'Edit meeting offer',
    requiresAuth: true,
    footerHidden: true,
  },
];
