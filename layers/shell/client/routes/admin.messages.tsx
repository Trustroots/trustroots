import { createFileRoute } from '@tanstack/react-router';
import AdminMessages from '@/modules/admin/client/components/AdminMessages.component';
import { requireRole } from '../route-options';

export const Route = createFileRoute('/admin/messages')({
  staticData: { title: 'Admin - Messages', footerVariant: 'admin' },
  beforeLoad: requireRole('admin'),
  component: AdminMessages,
});
