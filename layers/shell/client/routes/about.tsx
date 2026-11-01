import { createRoute } from '@tanstack/react-router';
import HomeRoute from '@/modules/pages/client/components/HomeRoute';
import { routeOptions, renderWithUser } from '../route-options';

export const Route = createRoute(
  routeOptions('/about', renderWithUser(HomeRoute)),
);
