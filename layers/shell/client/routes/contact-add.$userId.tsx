import { createFileRoute } from '@tanstack/react-router';
import ContactAddPage from '@/modules/contacts/client/components/ContactAddPage.component';
import { routeOptions, renderWithUser } from '../route-options';

export const Route = createFileRoute('/contact-add/$userId')(
  routeOptions('/contact-add/:userId', renderWithUser(ContactAddPage)),
);
