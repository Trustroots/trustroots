import { createFileRoute } from '@tanstack/react-router';
import { VolunteeringRoute } from '@/modules/pages/client/route-views';

export const Route = createFileRoute('/volunteering')({
  staticData: { title: 'Volunteering' },
  component: VolunteeringRoute,
});
