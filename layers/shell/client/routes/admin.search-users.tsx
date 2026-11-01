import { createRoute } from '@tanstack/react-router';
import React from 'react';
import AdminSearchUsers from '@/modules/admin/client/components/AdminSearchUsers.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/admin/search-users', () => <AdminSearchUsers />),
);
