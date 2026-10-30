import {
  renderWithUser,
  type RouteRender,
} from '@/modules/core/client/react-app/route-render';
import SupportPage from '@/modules/support/client/components/SupportPage.component';

export const supportRoutes: Record<string, RouteRender> = {
  '/contact': renderWithUser(SupportPage),
  '/support': renderWithUser(SupportPage),
};
