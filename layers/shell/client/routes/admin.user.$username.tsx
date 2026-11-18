import { createFileRoute, useParams } from '@tanstack/react-router';
import React from 'react';
import AdminUser from '@/modules/admin/client/components/AdminUser.component';
import { SupportMemberPage } from '@/modules/admin/client/components/Support.component';
import { useAuth } from '@/modules/core/client/react-app/auth';
import { routeOptions } from '../route-options';

export function AdminUserRoute() {
  const { hasRole, user } = useAuth();
  const { username } = useParams({ strict: false });
  return hasRole('admin') ? (
    <AdminUser username={username} viewer={user} />
  ) : (
    <SupportMemberPage id={username} />
  );
}

export const Route = createFileRoute('/admin/user/$username')(
  routeOptions('/admin/user/:username', AdminUserRoute),
);
