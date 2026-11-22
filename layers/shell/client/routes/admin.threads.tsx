import { createFileRoute } from '@tanstack/react-router';
import AdminThreads from '@/modules/admin/client/components/AdminThreads.component';
import { requireRole } from '../route-options';

export const Route = createFileRoute('/admin/threads')({
  staticData: { title: 'Admin - Threads', footerVariant: 'admin' },
  beforeLoad: requireRole('admin'),
  component: AdminThreads,
});
