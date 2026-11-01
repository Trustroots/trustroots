import { createRoute } from '@tanstack/react-router';
import Inbox from '@/modules/messages/client/components/Inbox.component';
import { routeOptions, renderWithUser } from '../route-options';

export const Route = createRoute(
  routeOptions('/messages', renderWithUser(Inbox)),
);
