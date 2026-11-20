import { createFileRoute } from '@tanstack/react-router';
import ContactAddPage from '@/modules/contacts/client/components/ContactAddPage.component';
import { requireAuth, withUser } from '../route-options';

export const Route = createFileRoute('/contact-add/$userId')({
  staticData: { title: 'Add contact' },
  beforeLoad: requireAuth,
  component: withUser(ContactAddPage),
});
