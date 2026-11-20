import { createFileRoute } from '@tanstack/react-router';
import FlaggedMembers from '@/modules/admin/client/components/FlaggedMembers.component';
import { adminPolicy, routeOptions } from '../route-options';
export const Route = createFileRoute('/admin/support/flagged')(
  routeOptions(
    adminPolicy('Support - Flagged members', ['admin', 'support-team']),
    FlaggedMembers,
  ),
);
