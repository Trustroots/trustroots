import { createFileRoute } from '@tanstack/react-router';
import Inbox from '@/modules/messages/client/components/Inbox.component';
import { requireAuth, withUser } from '../route-options';

export const Route = createFileRoute('/messages/')({
  staticData: { title: 'Messages' },
  beforeLoad: requireAuth,
  component: withUser(Inbox),
});
