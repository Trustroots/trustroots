import { createFileRoute } from '@tanstack/react-router';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/profile/$username/about')(
  routeOptions({ title: 'Profile', requiresAuth: true, noScrollingTop: true }),
);
