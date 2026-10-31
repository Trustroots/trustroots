import { createRoute } from '@tanstack/react-router';
import { pagesRoutes } from '@/modules/pages/client/routes';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/faq/bugs-and-features', pagesRoutes['/faq/bugs-and-features']),
);
