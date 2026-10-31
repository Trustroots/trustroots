import { createRoute } from '@tanstack/react-router';
import { messagesRoutes } from '@/modules/messages/client/routes';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/messages', messagesRoutes['/messages']),
);
