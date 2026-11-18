import { createFileRoute } from '@tanstack/react-router';
import ContactConfirmPage from '@/modules/contacts/client/components/ContactConfirmPage.component';
import { routeOptions, renderWithUser } from '../route-options';

export const Route = createFileRoute('/contact-confirm/$contactId')(
  routeOptions(
    '/contact-confirm/:contactId',
    renderWithUser(ContactConfirmPage),
  ),
);
