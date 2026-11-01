import { createRoute } from '@tanstack/react-router';
import React from 'react';
import AdminSpamCleanup from '@/modules/admin/client/components/AdminSpamCleanup';
import { routeOptions } from '../route-options';

export const Route = createRoute(
  routeOptions('/admin/spam-cleanup', () => <AdminSpamCleanup />),
);
