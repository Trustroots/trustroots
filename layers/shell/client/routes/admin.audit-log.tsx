import { createFileRoute } from '@tanstack/react-router';
import AdminAuditLog from '@/modules/admin/client/components/AdminAuditLog.component';
import { adminPolicy, routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/audit-log')(
  routeOptions(adminPolicy('Admin - Audit log'), AdminAuditLog),
);
