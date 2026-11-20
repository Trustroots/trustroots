import { createFileRoute } from '@tanstack/react-router';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/profile/$username/contacts')(
  routeOptions({
    title: 'Profile contacts',
    requiresAuth: true,
    noScrollingTop: true,
  }),
);
