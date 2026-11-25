import { createFileRoute } from '@tanstack/react-router';
import { requireRole } from '../route-options';
import { AdminUserSearchRoute } from '@/modules/admin/client/route-views';

export const Route = createFileRoute('/admin/user/')({
  staticData: { title: 'Admin - User', footerVariant: 'admin' },
  beforeLoad: requireRole('admin'),
  component: AdminUserSearchRoute,
});
