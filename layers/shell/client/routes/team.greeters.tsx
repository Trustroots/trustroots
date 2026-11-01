import { createRoute } from '@tanstack/react-router';
import Greeters from '@/modules/pages/client/components/Greeters.component';
import { routeOptions, renderWithUser } from '../route-options';

export const Route = createRoute(
  routeOptions('/team/greeters', renderWithUser(Greeters)),
);
