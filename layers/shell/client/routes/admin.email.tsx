import { createFileRoute } from '@tanstack/react-router';
import AdminEmail from '@/modules/admin/client/components/AdminEmail.component';
import { requireRole } from '../route-options';

export const Route = createFileRoute('/admin/email')({
  staticData: { title: 'Admin - Email', footerVariant: 'admin' },
  beforeLoad: requireRole('admin'),
  component: AdminEmail,
});
