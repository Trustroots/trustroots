import { createRoute } from '@tanstack/react-router';
import { supportRoutes } from '@/modules/support/client/routes';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/support', supportRoutes['/support']),
);
