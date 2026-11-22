import { createFileRoute } from '@tanstack/react-router';
import AdminAuditLog from '@/modules/admin/client/components/AdminAuditLog.component';
import { requireRole } from '../route-options';

export const Route = createFileRoute('/admin/audit-log')({
  staticData: { title: 'Admin - Audit log', footerVariant: 'admin' },
  beforeLoad: requireRole('admin'),
  component: AdminAuditLog,
});
