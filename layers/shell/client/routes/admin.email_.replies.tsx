import { createFileRoute } from '@tanstack/react-router';
import AdminEmailReplies from '@/modules/admin/client/components/AdminEmailReplies.component';
import { requireRole } from '../route-options';

export const Route = createFileRoute('/admin/email_/replies')({
  staticData: { title: 'Admin - Email replies', footerVariant: 'admin' },
  beforeLoad: requireRole('admin'),
  component: AdminEmailReplies,
});
