import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import AdminUser from '@/modules/admin/client/components/AdminUser.component';
import { useAuth } from '@/modules/core/client/react-app/auth';
import { routeOptions } from '../route-options';

function AdminUserSearchRoute() {
  const { user } = useAuth();
  return <AdminUser viewer={user} />;
}

export const Route = createFileRoute('/admin/user/')(
  routeOptions('/admin/user', AdminUserSearchRoute),
);
