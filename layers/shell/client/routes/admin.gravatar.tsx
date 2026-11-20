import { createFileRoute } from '@tanstack/react-router';
import AdminGravatar from '@/modules/admin/client/components/AdminGravatar.component';
import { requireRole } from '../route-options';

export const Route = createFileRoute('/admin/gravatar')({
  staticData: { title: 'Admin - Gravatar usage', footerVariant: 'admin' },
  beforeLoad: requireRole('admin'),
  component: AdminGravatar,
});
