import { createFileRoute } from '@tanstack/react-router';
import { SupportMemberSearchPage } from '@/modules/admin/client/components/Support.component';
import { adminPolicy, routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/support/members')(
  routeOptions(
    adminPolicy('Support - Member search', ['admin', 'support-team']),
    SupportMemberSearchPage,
  ),
);
