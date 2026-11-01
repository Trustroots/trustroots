import { createRoute } from '@tanstack/react-router';
import Team from '@/modules/pages/client/components/Team.component';
import { routeOptions, renderWithUser } from '../route-options';

export const Route = createRoute(routeOptions('/team', renderWithUser(Team)));
