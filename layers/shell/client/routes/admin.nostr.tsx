import { createFileRoute } from '@tanstack/react-router';
import AdminNostr from '@/modules/admin/client/components/AdminNostr.component';
import { requireRole } from '../route-options';

export const Route = createFileRoute('/admin/nostr')({
  staticData: { title: 'Admin - Featured Nostr notes', footerVariant: 'admin' },
  beforeLoad: requireRole('admin'),
  component: AdminNostr,
});
