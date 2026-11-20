import { createFileRoute } from '@tanstack/react-router';
import AdminHackerspaces from '@/modules/admin/client/components/AdminHackerspaces.component';
import { requireRole } from '../route-options';

export const Route = createFileRoute('/admin/hackerspaces')({
  staticData: { title: 'Admin - Hackerspaces', footerVariant: 'admin' },
  beforeLoad: requireRole('admin'),
  component: AdminHackerspaces,
});
