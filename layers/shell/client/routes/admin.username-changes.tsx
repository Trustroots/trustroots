import { createRoute } from '@tanstack/react-router';
import React from 'react';
import AdminUsernameChanges from '@/modules/admin/client/components/AdminUsernameChanges.component';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/admin/username-changes', () => <AdminUsernameChanges />),
);
