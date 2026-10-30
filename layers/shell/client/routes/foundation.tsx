import { createRoute } from '@tanstack/react-router';
import { pagesRoutes } from '@/modules/pages/client/routes';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/foundation', pagesRoutes['/foundation']),
);
