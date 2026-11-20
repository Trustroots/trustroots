import { createFileRoute } from '@tanstack/react-router';
import AdminStaffBlockers from '@/modules/admin/client/components/AdminStaffBlockers.component';
import { requireRole } from '../route-options';

export const Route = createFileRoute('/admin/staff-blockers')({
  staticData: { title: 'Admin - Staff blockers', footerVariant: 'admin' },
  beforeLoad: requireRole('admin', 'welcome-team', 'support-team'),
  component: AdminStaffBlockers,
});
