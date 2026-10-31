import { createRoute } from '@tanstack/react-router';
import { searchRoutes } from '@/modules/search/client/routes';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/search/members', searchRoutes['/search/members']),
);
