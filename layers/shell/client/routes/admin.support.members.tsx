import { createFileRoute } from '@tanstack/react-router';
import { SupportMemberSearchPage } from '@/modules/admin/client/components/Support.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/support/members')(
  routeOptions('/admin/support/members', SupportMemberSearchPage),
);
