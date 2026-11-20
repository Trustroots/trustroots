import { createFileRoute } from '@tanstack/react-router';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/profile/$username/experiences/new')(
  routeOptions({
    title: 'Share your experience',
    requiresAuth: true,
    noScrollingTop: true,
  }),
);
