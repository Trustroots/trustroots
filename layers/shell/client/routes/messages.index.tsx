import { createFileRoute } from '@tanstack/react-router';
import Inbox from '@/modules/messages/client/components/Inbox.component';
import { routeOptions, withUser } from '../route-options';

export const Route = createFileRoute('/messages/')(
  routeOptions({ title: 'Messages', requiresAuth: true }, withUser(Inbox)),
);
