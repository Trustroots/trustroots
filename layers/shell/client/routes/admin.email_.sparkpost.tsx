import { createFileRoute } from '@tanstack/react-router';
import AdminSparkpost from '@/modules/admin/client/components/AdminSparkpost.component';
import { requireRole } from '../route-options';

export const Route = createFileRoute('/admin/email_/sparkpost')({
  staticData: { title: 'Admin - SparkPost', footerVariant: 'admin' },
  beforeLoad: requireRole('admin'),
  component: AdminSparkpost,
});
