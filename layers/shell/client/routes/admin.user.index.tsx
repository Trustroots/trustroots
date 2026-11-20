import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import AdminUser from '@/modules/admin/client/components/AdminUser.component';
import type { AuthUser } from '@/modules/core/client/react-app/auth';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/user/')(
  routeOptions('/admin/user', ({ user }) => (
    <AdminUser viewer={user as AuthUser} />
  )),
);
