import { createFileRoute } from '@tanstack/react-router';
import ContactAddPage from '@/modules/contacts/client/components/ContactAddPage.component';
import { routeOptions, withUser } from '../route-options';

export const Route = createFileRoute('/contact-add/$userId')(
  routeOptions('/contact-add/:userId', withUser(ContactAddPage)),
);
