import { createFileRoute } from '@tanstack/react-router';
import ContactConfirmPage from '@/modules/contacts/client/components/ContactConfirmPage.component';
import { requireAuth, withUser } from '../route-options';

export const Route = createFileRoute('/contact-confirm/$contactId')({
  staticData: { title: 'Confirm contact' },
  beforeLoad: requireAuth,
  component: withUser(ContactConfirmPage),
});
