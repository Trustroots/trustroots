import { createFileRoute } from '@tanstack/react-router';
import AdminNewsletter from '@/modules/admin/client/components/AdminNewsletter.component';
import { requireRole } from '../route-options';

export const Route = createFileRoute('/admin/newsletter')({
  staticData: { title: 'Admin - Newsletter', footerVariant: 'admin' },
  beforeLoad: requireRole('admin'),
  component: AdminNewsletter,
});
