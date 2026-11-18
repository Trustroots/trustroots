import { createFileRoute } from '@tanstack/react-router';
import React from 'react';
import AdminUsernameChanges from '@/modules/admin/client/components/AdminUsernameChanges.component';
import { routeOptions } from '../route-options';

export const Route = createFileRoute('/admin/username-changes')(
  routeOptions('/admin/username-changes', () => <AdminUsernameChanges />),
);
