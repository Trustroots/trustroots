import { createFileRoute } from '@tanstack/react-router';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/profile/$username/overview')(
  routeOptions({
    title: 'Profile overview',
    requiresAuth: true,
    noScrollingTop: true,
  }),
);
