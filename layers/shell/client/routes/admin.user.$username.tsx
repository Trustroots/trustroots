import { createRoute } from '@tanstack/react-router';
import React from 'react';
import AdminUser from '@/modules/admin/client/components/AdminUser.component';
import type { AuthUser } from '@/modules/core/client/react-app/auth';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/admin/user/:username', ({ params, user }) => (
    <AdminUser username={params.username} viewer={user as AuthUser} />
  )),
);
