import { createRoute } from '@tanstack/react-router';
import React from 'react';
import AdminUser from '@/modules/admin/client/components/AdminUser.component';
import { SupportMemberPage } from '@/modules/admin/client/components/Support.component';
import { userHasRole } from '@/modules/core/client/react-app/auth';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/admin/user/:username', ({ params, user }) =>
    userHasRole(user, 'admin') ? (
      <AdminUser username={params.username} viewer={user ?? undefined} />
    ) : (
      <SupportMemberPage id={params.username} />
    ),
  ),
);
