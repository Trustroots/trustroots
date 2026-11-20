import { createFileRoute } from '@tanstack/react-router';
import Privacy from '@/modules/pages/client/components/Privacy.component';

export const Route = createFileRoute('/privacy')({
  staticData: { title: 'Privacy policy' },
  component: Privacy,
});
