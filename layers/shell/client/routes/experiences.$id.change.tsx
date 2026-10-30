import { createRoute } from '@tanstack/react-router';
import { experiencesRoutes } from '@/modules/experiences/client/routes';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions(
    '/experiences/:id/change',
    experiencesRoutes['/experiences/:id/change'],
  ),
);
