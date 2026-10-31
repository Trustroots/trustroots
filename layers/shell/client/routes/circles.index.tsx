import { createRoute } from '@tanstack/react-router';
import { tribesRoutes } from '@/modules/tribes/client/routes';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/circles', tribesRoutes['/circles']),
);
