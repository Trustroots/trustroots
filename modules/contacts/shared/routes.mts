import type { ReactRoutePolicy } from '../../core/shared/react-route-ownership.mts';

export const CONTACTS_ROUTE_POLICIES: ReactRoutePolicy[] = [
  { path: '/contact-add/:userId', title: 'Add contact', requiresAuth: true },
  {
    path: '/contact-confirm/:contactId',
    title: 'Confirm contact',
    requiresAuth: true,
  },
];
