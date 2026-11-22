import { createFileRoute } from '@tanstack/react-router';
import AdminUsernameChanges from '@/modules/admin/client/components/AdminUsernameChanges.component';
import { requireRole } from '../route-options';

export const Route = createFileRoute('/admin/username-changes')({
  staticData: { title: 'Admin - Username changes', footerVariant: 'admin' },
  beforeLoad: requireRole('admin'),
  component: AdminUsernameChanges,
});
