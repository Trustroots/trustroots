import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import AdminUser from '@/modules/admin/client/components/AdminUser.component';
import { useAuth } from '@trustroots/core/auth';
import { requireRole } from '../route-options';

function AdminUserSearchRoute() {
  const { user } = useAuth();
  return <AdminUser viewer={user} />;
}

export const Route = createFileRoute('/admin/user/')({
  staticData: { title: 'Admin - User', footerVariant: 'admin' },
  beforeLoad: requireRole('admin'),
  component: AdminUserSearchRoute,
});
