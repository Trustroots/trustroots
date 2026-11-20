import { createFileRoute } from '@tanstack/react-router';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/profile/$username/tribes')(
  routeOptions({
    title: 'Profile tribes',
    requiresAuth: true,
    noScrollingTop: true,
  }),
);
