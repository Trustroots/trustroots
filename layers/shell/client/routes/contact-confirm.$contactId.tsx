import { createRoute } from '@tanstack/react-router';
import { contactsRoutes } from '@/modules/contacts/client/routes';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions(
    '/contact-confirm/:contactId',
    contactsRoutes['/contact-confirm/:contactId'],
  ),
);
