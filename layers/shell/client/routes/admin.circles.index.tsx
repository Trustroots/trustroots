import { createFileRoute } from '@tanstack/react-router';
import AdminCircles from '@/modules/admin/client/components/AdminCircles.component';
import { requireRole } from '../route-options';

export const Route = createFileRoute('/admin/circles/')({
  staticData: { title: 'Admin - Circles', footerVariant: 'admin' },
  beforeLoad: requireRole('admin'),
  component: AdminCircles,
});
