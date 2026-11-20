import { createFileRoute } from '@tanstack/react-router';
import Team from '@/modules/pages/client/components/Team.component';
import { routeOptions, withUser } from '../route-options';

export const Route = createFileRoute('/team/')(
  routeOptions('/team', withUser(Team)),
);
