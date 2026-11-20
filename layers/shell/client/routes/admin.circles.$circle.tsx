import { createFileRoute } from '@tanstack/react-router';
import AdminCircles from '@/modules/admin/client/components/AdminCircles.component';
import { requireRole } from '../route-options';

export const Route = createFileRoute('/admin/circles/$circle')({
  staticData: { title: 'Admin - Circle', footerVariant: 'admin' },
  beforeLoad: requireRole('admin'),
  component: AdminCircles,
});
