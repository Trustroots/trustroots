import { createFileRoute } from '@tanstack/react-router';
import ContactConfirmPage from '@/modules/contacts/client/components/ContactConfirmPage.component';
import { routeOptions, withUser } from '../route-options';

export const Route = createFileRoute('/contact-confirm/$contactId')(
  routeOptions(
    { title: 'Confirm contact', requiresAuth: true },
    withUser(ContactConfirmPage),
  ),
);
