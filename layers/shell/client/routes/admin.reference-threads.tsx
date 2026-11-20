import { createFileRoute } from '@tanstack/react-router';
import AdminReferenceThreads from '@/modules/admin/client/components/AdminReferenceThreads.component';
import { requireRole } from '../route-options';

export const Route = createFileRoute('/admin/reference-threads')({
  staticData: { title: 'Admin - Reference threads', footerVariant: 'admin' },
  beforeLoad: requireRole('admin'),
  component: AdminReferenceThreads,
});
