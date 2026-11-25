import { createFileRoute } from '@tanstack/react-router';
import { requireAuth } from '../route-options';
import { ThreadRoute } from '@/modules/messages/client/route-views';

export const Route = createFileRoute('/messages/$username')({
  staticData: { title: 'Messages', footerHidden: true },
  beforeLoad: requireAuth,
  component: ThreadRoute,
});
