import { createFileRoute } from '@tanstack/react-router';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/profile/$username/accommodation')(
  routeOptions({
    title: 'Profile accommodation',
    requiresAuth: true,
    noScrollingTop: true,
  }),
);
