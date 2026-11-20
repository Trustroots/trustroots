import { createFileRoute } from '@tanstack/react-router';
import SupportPage from '@/modules/support/client/components/SupportPage.component';
import { withUser } from '../route-options';

export const Route = createFileRoute('/support')({
  staticData: { title: 'Support' },
  component: withUser(SupportPage),
});
