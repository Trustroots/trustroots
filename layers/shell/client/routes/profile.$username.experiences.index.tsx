import { createFileRoute } from '@tanstack/react-router';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/profile/$username/experiences/')(
  routeOptions({
    title: 'Experiences',
    requiresAuth: true,
    noScrollingTop: true,
  }),
);
