import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import AdminAuditLog from '@/modules/admin/client/components/AdminAuditLog.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/audit-log')(
  routeOptions('/admin/audit-log', () => <AdminAuditLog />),
);
