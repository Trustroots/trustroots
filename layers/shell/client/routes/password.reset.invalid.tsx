import { createRoute } from '@tanstack/react-router';
import { usersRoutes } from '@/modules/users/client/routes';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions(
    '/password/reset/invalid',
    usersRoutes['/password/reset/invalid'],
  ),
);
