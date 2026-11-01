import { createRoute } from '@tanstack/react-router';
import ContactConfirmPage from '@/modules/contacts/client/components/ContactConfirmPage.component';
import { routeOptions, renderWithUser } from '../route-options';

export const Route = createRoute(
  routeOptions(
    '/contact-confirm/:contactId',
    renderWithUser(ContactConfirmPage),
  ),
);
