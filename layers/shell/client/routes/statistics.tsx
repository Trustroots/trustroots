import { createRoute } from '@tanstack/react-router';
import { statisticsRoutes } from '@/modules/statistics/client/routes';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/statistics', statisticsRoutes['/statistics']),
);
