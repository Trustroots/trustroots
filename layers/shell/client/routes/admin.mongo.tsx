import { createFileRoute } from '@tanstack/react-router';
import AdminMongo from '@/modules/admin/client/components/AdminMongo.component';
import { requireRole } from '../route-options';

export const Route = createFileRoute('/admin/mongo')({
  staticData: { title: 'Admin - MongoDB diagnostics', footerVariant: 'admin' },
  beforeLoad: requireRole('admin'),
  component: AdminMongo,
});
