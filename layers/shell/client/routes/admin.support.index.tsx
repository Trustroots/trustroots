import { createFileRoute } from '@tanstack/react-router';
import SupportInbox from '@/modules/admin/client/components/Support.component';
import { adminPolicy, routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/support/')(
  routeOptions(adminPolicy('Support', ['admin', 'support-team']), SupportInbox),
);
