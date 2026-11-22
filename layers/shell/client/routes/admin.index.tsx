import { createFileRoute } from '@tanstack/react-router';
import Admin from '@/modules/admin/client/components/Admin.component';
import { requireRole } from '../route-options';

export const Route = createFileRoute('/admin/')({
  staticData: { title: 'Admin', footerVariant: 'admin' },
  beforeLoad: requireRole('admin', 'support-team'),
  component: Admin,
});
