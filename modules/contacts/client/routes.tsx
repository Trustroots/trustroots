import {
  renderWithUser,
  type RouteRender,
} from '@/modules/core/client/react-app/route-render';
import ContactAddPage from '@/modules/contacts/client/components/ContactAddPage.component';
import ContactConfirmPage from '@/modules/contacts/client/components/ContactConfirmPage.component';

export const contactsRoutes: Record<string, RouteRender> = {
  '/contact-add/:userId': renderWithUser(ContactAddPage),
  '/contact-confirm/:contactId': renderWithUser(ContactConfirmPage),
};
