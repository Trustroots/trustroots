import { createRoute } from '@tanstack/react-router';
import ContactAddPage from '@/modules/contacts/client/components/ContactAddPage.component';
import { routeOptions, renderWithUser } from '../route-options';

export const Route = createRoute(
  routeOptions('/contact-add/:userId', renderWithUser(ContactAddPage)),
);
