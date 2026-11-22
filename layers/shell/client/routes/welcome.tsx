import { createFileRoute } from '@tanstack/react-router';
import Welcome from '@/modules/users/client/components/Welcome.component';
import { requireAuth } from '../route-options';

export const Route = createFileRoute('/welcome')({
  staticData: { title: 'Welcome', footerHidden: true },
  beforeLoad: requireAuth,
  component: Welcome,
});
