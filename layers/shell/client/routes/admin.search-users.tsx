import { createFileRoute } from '@tanstack/react-router';
import AdminSearchUsers from '@/modules/admin/client/components/AdminSearchUsers.component';
import { requireRole } from '../route-options';

export const Route = createFileRoute('/admin/search-users')({
  staticData: { title: 'Admin - Search users', footerVariant: 'admin' },
  beforeLoad: requireRole('admin'),
  component: AdminSearchUsers,
});
