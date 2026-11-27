import { createFileRoute } from '@tanstack/react-router';
import { VolunteeringRoute } from '@trustroots/pages/route-views';

export const Route = createFileRoute('/volunteering')({
  staticData: { title: 'Volunteering' },
  component: VolunteeringRoute,
});
