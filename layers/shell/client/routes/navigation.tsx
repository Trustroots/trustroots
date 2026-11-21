import { createFileRoute } from '@tanstack/react-router';
import Navigation from '@/modules/pages/client/components/Navigation.component';
import { requireAuth, withUser } from '../route-options';

export const Route = createFileRoute('/navigation')({
  staticData: { title: 'Navigation', footerHidden: true },
  beforeLoad: requireAuth,
  component: withUser(Navigation),
});
