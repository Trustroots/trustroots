import { createFileRoute } from '@tanstack/react-router';
import AdminStaffBlockers from '@/modules/admin/client/components/AdminStaffBlockers.component';
import { adminPolicy, routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/staff-blockers')(
  routeOptions(
    adminPolicy('Admin - Staff blockers', [
      'admin',
      'welcome-team',
      'support-team',
    ]),
    AdminStaffBlockers,
  ),
);
