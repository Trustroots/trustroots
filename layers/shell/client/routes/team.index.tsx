import { createFileRoute } from '@tanstack/react-router';
import Team from '@/modules/pages/client/components/Team.component';
import { routeOptions, renderWithUser } from '../route-options';

export const Route = createFileRoute('/team/')(
  routeOptions('/team', renderWithUser(Team)),
);
