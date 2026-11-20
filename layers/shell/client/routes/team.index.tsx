import { createFileRoute } from '@tanstack/react-router';
import Team from '@/modules/pages/client/components/Team.component';
import { withUser } from '../route-options';

export const Route = createFileRoute('/team/')({
  staticData: { title: 'Team' },
  component: withUser(Team),
});
